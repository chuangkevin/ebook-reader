#!/usr/bin/env python3
"""Deploy a built Readflix image pair; all recovery material stays on the host."""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone

SERVICES = ("backend", "frontend")
RESERVE_BYTES = 512 * 1024 * 1024
HEALTH_ATTEMPTS = 30
HEALTH_INTERVAL = 2


class DeployError(Exception):
    pass


def run(*args, capture=False, env=None):
    # Command output can contain host configuration or filenames. Keep it local.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, env=env, check=False)
    if result.returncode:
        raise DeployError(f"{args[0]} operation failed (exit {result.returncode})")
    return result.stdout.strip() if capture else None


def compose(root, config, project=None, *args, env=None):
    command = ["docker", "compose", "--project-directory", str(root), "-f", str(config)]
    if project:
        command += ["--project-name", project]
    return run(*command, *args, capture=True, env=env)


def inspect_container(name):
    return json.loads(run("docker", "inspect", name, capture=True))[0]


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def install(source, destination):
    temporary = destination.with_name(destination.name + ".next")
    shutil.copyfile(source, temporary)
    os.replace(temporary, destination)


def data_mount(config):
    volumes = config["services"]["backend"].get("volumes", [])
    mounts = [v for v in volumes if v.get("target") == "/app/data"]
    if len(mounts) != 1 or mounts[0].get("type") != "bind" or mounts[0].get("read_only"):
        raise DeployError("Backend must have one writable /app/data bind mount")
    return Path(mounts[0]["source"]).resolve(strict=True)


def inventory(data):
    files = []
    for path in [data, *data.rglob("*")]:
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise DeployError("Data contains a symlink or special file; manual backup required")
        files.append(path)
    return files


def check_space(root, data):
    # An uncompressed archive avoids an optimistic compression estimate.
    needed = sum(p.stat().st_size + 2048 for p in inventory(data))
    if shutil.disk_usage(root).free < needed + needed // 10 + RESERVE_BYTES:
        raise DeployError("Insufficient space for a full data archive plus disk reserve")


def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def backup_data(data, destination):
    paths = inventory(data)
    with tarfile.open(destination, "w", dereference=True) as archive:
        archive.add(data, arcname="data")
    # Read every archived byte and compare against the quiescent source. Nothing
    # is extracted, sent to CI, or written to the deployment log.
    expected = {str(Path("data") / p.relative_to(data)): p for p in paths}
    with tarfile.open(destination, "r") as archive:
        members = archive.getmembers()
        if len(members) != len(expected) or {m.name for m in members} != set(expected):
            raise DeployError("Backup file inventory verification failed")
        for member in members:
            source = expected[member.name]
            if member.isdir() and source.is_dir():
                continue
            if not member.isfile() or not source.is_file() or member.size != source.stat().st_size:
                raise DeployError("Backup metadata verification failed")
            with source.open("rb") as original, archive.extractfile(member) as stored:
                if digest(original) != digest(stored):
                    raise DeployError("Backup content verification failed")
    with destination.open("rb") as archive:
        checksum = digest(archive)
    destination.with_suffix(".tar.sha256").write_text(f"{checksum}  {destination.name}\n")


def healthy(containers, images=None):
    for service in SERVICES:
        container = inspect_container(containers[service])
        if images and container["Image"] != images[service]:
            return False
        state = container["State"]
        if not state.get("Running") or state.get("Restarting"):
            return False
        if state.get("Health", {}).get("Status", "healthy") != "healthy":
            return False
    # Exercise both HTTP servers without exposing response bodies or library data.
    run("docker", "exec", containers["backend"], "node", "-e",
        "const r=require('http').get('http://127.0.0.1:3003/health',"
        "r=>{r.resume();process.exit(r.statusCode===200?0:1)});"
        "r.setTimeout(5000,()=>process.exit(1));r.on('error',()=>process.exit(1));")
    run("docker", "exec", containers["frontend"], "wget", "-q", "-T", "5",
        "-O", "/dev/null", "http://127.0.0.1/")
    return True


def wait_healthy(containers, images=None):
    for attempt in range(HEALTH_ATTEMPTS):
        try:
            if healthy(containers, images):
                return
        except DeployError:
            pass
        if attempt + 1 < HEALTH_ATTEMPTS:
            time.sleep(HEALTH_INTERVAL)
    raise DeployError("Frontend/backend health verification failed")


def transaction(root, candidate, sha):
    root = root.resolve(strict=True)
    candidate = candidate.resolve(strict=True)
    live = root / "docker-compose.yml"
    if not live.is_file() or live.is_symlink():
        raise DeployError("Expected an existing regular docker-compose.yml")
    current = json.loads(compose(root, live, None, "config", "--format", "json"))
    if set(current["services"]) != set(SERVICES):
        raise DeployError("Expected only the existing frontend and backend services")
    containers = {s: current["services"][s]["container_name"] for s in SERVICES}
    old = {s: inspect_container(containers[s]) for s in SERVICES}
    projects = {v["Config"]["Labels"].get("com.docker.compose.project") for v in old.values()}
    if len(projects) != 1 or None in projects or "" in projects:
        raise DeployError("Existing containers do not share a Compose project")
    project = projects.pop()
    for service in SERVICES:
        if old[service]["Config"]["Labels"].get("com.docker.compose.service") != service:
            raise DeployError("Existing Compose service identity does not match")
        if not old[service]["State"].get("Running"):
            raise DeployError("Both existing services must be running before deployment")
    current = json.loads(compose(root, live, project, "config", "--format", "json"))
    data = data_mount(current)
    actual = [v for v in old["backend"]["Mounts"] if v["Destination"] == "/app/data"]
    if (len(actual) != 1 or actual[0]["Type"] != "bind" or not actual[0].get("RW")
            or Path(actual[0]["Source"]).resolve(strict=True) != data
            or data != (root / "data").resolve(strict=True) or root not in data.parents):
        raise DeployError("Actual backend data mount does not match the deployment data directory")
    if not (data / "db" / "ebook-reader.sqlite").is_file():
        raise DeployError("Existing SQLite database is missing; refusing an empty deployment")
    environment = dict(os.environ, READFLIX_IMAGE_TAG=f"sha-{sha}")
    upcoming = json.loads(compose(root, candidate, project, "config", "--format", "json", env=environment))
    if set(upcoming["services"]) != set(SERVICES) or data_mount(upcoming) != data:
        raise DeployError("New Compose changes the services or persistent data mount")
    if upcoming.get("networks") != current.get("networks"):
        raise DeployError("New Compose changes the existing project networks")
    for service in SERVICES:
        wanted = f"kevin950805/readflix-{service}:sha-{sha}"
        if (upcoming["services"][service]["image"] != wanted
                or upcoming["services"][service].get("container_name") != containers[service]):
            raise DeployError("New Compose image or container identity does not match the release")
    check_space(root, data)
    releases = root / ".readflix-releases"
    if releases.is_symlink():
        raise DeployError("Release directory must not be a symlink")
    releases.mkdir(mode=0o700, exist_ok=True)
    token = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + "-" + sha[:12]
    recovery = releases / token
    recovery.mkdir(mode=0o700)
    shutil.copyfile(live, recovery / "previous-compose.yml")
    rollback = json.loads(json.dumps(current))
    receipt = {"sha": sha, "project": project, "previous_images": {}, "images": {}}
    for service in SERVICES:
        image = old[service]["Image"]
        run("docker", "image", "inspect", image)
        # Named rollback tags keep the exact old images reachable locally.
        tag = f"readflix-rollback-{service}:{token.lower()}"
        run("docker", "image", "tag", image, tag)
        rollback["services"][service]["image"] = image
        receipt["previous_images"][service] = {"id": image, "retained_tag": tag}
    rollback_file = recovery / "rollback-compose.json"
    write_json(rollback_file, rollback)
    write_json(recovery / "receipt.json", receipt)
    # Pull and validate the entire pair before pausing any running service.
    for service in SERVICES:
        image = upcoming["services"][service]["image"]
        for attempt in range(3):
            try:
                run("docker", "pull", image)
                break
            except DeployError:
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))
        metadata = json.loads(run("docker", "image", "inspect", image, capture=True))[0]
        if metadata["Architecture"] != "arm64":
            raise DeployError("Release image is not ARM64")
        receipt["images"][service] = {"tag": image, "id": metadata["Id"]}
        upcoming["services"][service]["image"] = metadata["Id"]
    prepared = recovery / "release-compose.json"
    write_json(prepared, upcoming)
    write_json(recovery / "receipt.json", receipt)
    check_space(root, data)
    stopped = False
    replaced = False
    succeeded = False
    try:
        # Set recovery state first: even a partially failed stop must restart the backend.
        stopped = True
        run("docker", "stop", "--time", "60", containers["backend"])
        state = inspect_container(containers["backend"])["State"]
        if state.get("Running") or state.get("ExitCode") != 0 or state.get("OOMKilled"):
            raise DeployError("Backend did not stop gracefully; backup aborted")
        backup_data(data, recovery / "data.tar")
        print("Full data archive verified on the deployment host.", flush=True)
        replaced = True
        install(prepared, live)
        compose(root, live, project, "up", "-d", "--force-recreate", "--pull", "never", "--no-build")
        wait_healthy(containers, {s: receipt["images"][s]["id"] for s in SERVICES})
        succeeded = True
    finally:
        if not succeeded and stopped:
            # Recovery must finish even if another cancellation/disconnect arrives.
            for signum in (signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
                signal.signal(signum, signal.SIG_IGN)
            if replaced:
                install(recovery / "previous-compose.yml", live)
                compose(root, rollback_file, project, "up", "-d", "--force-recreate", "--pull", "never", "--no-build")
            else:
                run("docker", "start", containers["backend"])
            wait_healthy(containers, {s: old[s]["Image"] for s in SERVICES})
            print("Previous services recovered; current data retained.", flush=True)
    (recovery / "verified").write_text(sha + "\n")
    print(f"Release {sha} verified: frontend and backend are healthy.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", required=True)
    parser.add_argument("--compose", required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.sha):
        raise DeployError("Expected a full Git commit SHA")
    root = Path(args.path).resolve(strict=True)
    candidate = Path(args.compose).resolve(strict=True)
    if not root.is_dir() or root == Path("/"):
        raise DeployError("Invalid deployment directory")
    os.umask(0o077)
    # Workflow concurrency plus a host lock prevents overlapping/manual releases.
    lock_path = root / ".readflix-deploy.lock"
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise DeployError("Another Readflix deployment holds the host lock") from error

        def interrupted(_signum, _frame):
            raise DeployError("Deployment interrupted")

        for signum in (signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
            signal.signal(signum, interrupted)
        transaction(root, candidate, args.sha)


if __name__ == "__main__":
    try:
        main()
    except DeployError as error:
        print(f"Deployment failed: {error}. Recovery material remains on the host.", file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Never include exception values: file errors can contain private names.
        print("Deployment failed. Recovery material remains on the host; inspect locally.", file=sys.stderr)
        sys.exit(1)
