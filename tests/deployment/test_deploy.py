"""Exercise the real deployment transaction against an isolated fake Docker host."""

import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "deploy", Path(__file__).resolve().parents[2] / "scripts" / "deploy.py")
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)
SHA = "a" * 40


class FakeDocker:
    def __init__(self, root, current, candidate):
        self.root = root
        self.current = current
        self.candidate = candidate
        self.calls = []
        self.pair = "old"
        self.running = True
        self.exit_code = 0
        self.fail_pull = False
        self.fail_stop = False
        self.fail_up = False
        self.fail_rollback = False
        self.fail_health = None
        self.actual_data = root / "data"
        self.new_write = False

    def __call__(self, *args, capture=False, env=None):
        self.calls.append(args)
        if args[:2] == ("docker", "compose"):
            config = Path(args[args.index("-f") + 1])
            if "config" in args:
                source = self.candidate if config.name == "candidate.yml" else self.current
                return json.dumps(source)
            if "up" in args:
                rollback = config.name == "rollback-compose.json"
                self.pair = "old" if rollback else "new"
                self.running = True
                if self.new_write and not rollback:
                    (self.root / "data" / "post-release-write").write_bytes(b"keep this write")
                if (rollback and self.fail_rollback) or (not rollback and self.fail_up):
                    raise deploy.DeployError("Mock container start failure")
                return ""
        if args[:2] == ("docker", "inspect"):
            service = args[-1].removeprefix("readflix-")
            container = {
                "Config": {"Labels": {"com.docker.compose.project": "existing_project",
                                      "com.docker.compose.service": service}},
                "State": {"Running": self.running if service == "backend" else True,
                          "ExitCode": self.exit_code, "OOMKilled": False},
                "Mounts": [{"Destination": "/app/data", "Type": "bind", "RW": True,
                            "Source": str(self.actual_data)}],
                "Image": f"sha256:{self.pair}-{service}",
            }
            return json.dumps([container])
        if args[:3] == ("docker", "image", "inspect"):
            return json.dumps([{"Id": "sha256:new-" + ("backend" if "backend" in args[-1] else "frontend"),
                                "Architecture": "arm64"}])
        if args[:3] == ("docker", "image", "tag"):
            return ""
        if args[:2] == ("docker", "pull"):
            if self.fail_pull:
                raise deploy.DeployError("Mock pull failure")
            return ""
        if args[:2] == ("docker", "stop"):
            self.running = False
            if self.fail_stop:
                raise deploy.DeployError("Mock partial stop failure")
            return ""
        if args[:2] == ("docker", "start"):
            self.running = True
            return ""
        if args[:2] == ("docker", "exec"):
            if self.pair == "new" and args[2] == f"readflix-{self.fail_health}":
                raise deploy.DeployError("Mock HTTP failure")
            return ""
        raise AssertionError(f"Unexpected Docker command: {args}")


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.data = self.root / "data"
        for folder in ("db", "books", "covers"):
            (self.data / folder).mkdir(parents=True)
        for name in ("db/ebook-reader.sqlite", "db/ebook-reader.sqlite-wal",
                     "db/ebook-reader.sqlite-shm", "books/private title.epub", "covers/private.png"):
            (self.data / name).write_bytes(b"private fixture:" + name.encode())
        self.live = self.root / "docker-compose.yml"
        self.live.write_text("# exact original compose\n")
        self.candidate_file = self.root / "candidate.yml"
        self.candidate_file.touch()
        current = {"name": "existing_project", "networks": {
            "readflix-network": {"name": "existing_project_readflix-network", "driver": "bridge"}},
            "services": {}}
        for service in deploy.SERVICES:
            current["services"][service] = {
                "image": f"kevin950805/readflix-{service}:latest",
                "container_name": f"readflix-{service}"}
        current["services"]["backend"]["volumes"] = [
            {"type": "bind", "source": str(self.data), "target": "/app/data"}]
        candidate = copy.deepcopy(current)
        for service in deploy.SERVICES:
            candidate["services"][service]["image"] = f"kevin950805/readflix-{service}:sha-{SHA}"
        self.docker = FakeDocker(self.root, current, candidate)
        for target, value in (("run", self.docker), ("HEALTH_ATTEMPTS", 2), ("HEALTH_INTERVAL", 0)):
            patcher = patch.object(deploy, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        for target in ("time.sleep", "signal.signal"):
            patcher = patch.object(deploy.time if target.startswith("time") else deploy.signal, target.split(".")[1])
            patcher.start()
            self.addCleanup(patcher.stop)
        self.original = {str(p.relative_to(self.data)): p.read_bytes()
                         for p in self.data.rglob("*") if p.is_file()}

    def execute(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            deploy.transaction(self.root, self.candidate_file, SHA)
        self.assertNotIn("private title", output.getvalue())
        return next((self.root / ".readflix-releases").iterdir())

    def assert_original_data(self):
        for name, content in self.original.items():
            self.assertEqual((self.data / name).read_bytes(), content)

    def assert_no_stop(self):
        self.assertFalse(any(c[:2] == ("docker", "stop") for c in self.docker.calls))
        self.assertEqual(self.live.read_text(), "# exact original compose\n")

    def test_success_preserves_data_backup_images_project_and_checks_both_services(self):
        recovery = self.execute()
        self.assertEqual((recovery / "verified").read_text().strip(), SHA)
        self.assertEqual((recovery / "previous-compose.yml").read_text(), "# exact original compose\n")
        live = json.loads(self.live.read_text())
        for service in deploy.SERVICES:
            self.assertEqual(live["services"][service]["image"], f"sha256:new-{service}")
            self.assertTrue(any(c[:3] == ("docker", "exec", f"readflix-{service}") for c in self.docker.calls))
        with tarfile.open(recovery / "data.tar") as archive:
            for name, content in self.original.items():
                self.assertEqual(archive.extractfile("data/" + name).read(), content)
        self.assertTrue((recovery / "data.tar.sha256").is_file())
        self.assertEqual(len([c for c in self.docker.calls if c[:3] == ("docker", "image", "tag")]), 2)
        up = next(c for c in self.docker.calls if "up" in c)
        self.assertEqual(up[up.index("--project-name") + 1], "existing_project")
        self.assertEqual(up[up.index("--pull") + 1], "never")
        self.assert_original_data()

    def test_failed_pull_keeps_original_containers_and_compose(self):
        self.docker.fail_pull = True
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assert_no_stop()
        self.assertTrue(self.docker.running)
        self.assert_original_data()

    def test_actual_mount_mismatch_fails_before_pull_or_stop(self):
        self.docker.actual_data = self.root
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assert_no_stop()
        self.assertFalse(any(c[:2] == ("docker", "pull") for c in self.docker.calls))

    def test_missing_database_fails_closed(self):
        (self.data / "db" / "ebook-reader.sqlite").unlink()
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assert_no_stop()

    def test_disk_space_failure_does_not_stop_backend(self):
        with patch.object(deploy.shutil, "disk_usage", return_value=shutil._ntuple_diskusage(100, 100, 0)):
            with self.assertRaises(deploy.DeployError):
                self.execute()
        self.assert_no_stop()

    def test_changed_network_rejected(self):
        self.docker.candidate["networks"]["readflix-network"]["name"] = "different_network"
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assert_no_stop()

    def test_partial_stop_failure_restarts_existing_backend(self):
        self.docker.fail_stop = True
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assertTrue(self.docker.running)
        self.assertIn(("docker", "start", "readflix-backend"), self.docker.calls)
        self.assertEqual(self.live.read_text(), "# exact original compose\n")

    def test_forced_stop_is_not_accepted_as_a_consistent_backup(self):
        self.docker.exit_code = 137
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assertTrue(self.docker.running)
        self.assertFalse(list((self.root / ".readflix-releases").rglob("data.tar")))

    def test_archive_verification_failure_restarts_existing_backend(self):
        with patch.object(deploy, "backup_data", side_effect=deploy.DeployError("Mock corrupt archive")):
            with self.assertRaises(deploy.DeployError):
                self.execute()
        self.assertTrue(self.docker.running)
        self.assertEqual(self.docker.pair, "old")
        self.assertFalse(any("up" in c for c in self.docker.calls))
        self.assert_original_data()

    def test_start_failure_restores_old_compose_and_both_old_image_ids(self):
        self.docker.fail_up = True
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assertEqual(self.live.read_text(), "# exact original compose\n")
        self.assertEqual(self.docker.pair, "old")
        rollback = next((self.root / ".readflix-releases").rglob("rollback-compose.json"))
        old = json.loads(rollback.read_text())
        self.assertEqual(old["services"]["backend"]["image"], "sha256:old-backend")
        self.assertEqual(old["services"]["frontend"]["image"], "sha256:old-frontend")
        self.assertFalse(list((self.root / ".readflix-releases").rglob("verified")))
        self.assert_original_data()

    def test_each_http_failure_rolls_back_without_restoring_data(self):
        for service in deploy.SERVICES:
            with self.subTest(service=service):
                self.docker.fail_health = service
                self.docker.new_write = True
                with self.assertRaises(deploy.DeployError):
                    self.execute()
                self.assertEqual(self.docker.pair, "old")
                self.assertEqual(self.live.read_text(), "# exact original compose\n")
                self.assertEqual((self.data / "post-release-write").read_bytes(), b"keep this write")
                self.assert_original_data()

    def test_recovery_failure_is_not_reported_as_success(self):
        self.docker.fail_up = True
        self.docker.fail_rollback = True
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assertEqual(self.live.read_text(), "# exact original compose\n")
        self.assertFalse(list((self.root / ".readflix-releases").rglob("verified")))
        self.assert_original_data()

    def test_archive_verification_detects_changed_bytes(self):
        original_open = deploy.tarfile.open
        def corrupt_before_verify(name, mode, **kwargs):
            if mode == "r":
                with original_open(name, "r") as archive:
                    offset = next(m.offset_data for m in archive.getmembers() if m.isfile())
                with Path(name).open("r+b") as stream:
                    stream.seek(offset)
                    stream.write(b"X")
            return original_open(name, mode, **kwargs)
        with patch.object(deploy.tarfile, "open", side_effect=corrupt_before_verify):
            with self.assertRaisesRegex(deploy.DeployError, "content verification"):
                deploy.backup_data(self.data, self.root / "corrupt.tar")
        self.assertFalse((self.root / "corrupt.tar.sha256").exists())
        self.assert_original_data()

    def test_candidate_cannot_mix_release_shas(self):
        self.docker.candidate["services"]["frontend"]["image"] = "kevin950805/readflix-frontend:sha-" + "b" * 40
        with self.assertRaises(deploy.DeployError):
            self.execute()
        self.assert_no_stop()

    def test_host_lock_refuses_overlapping_deployment(self):
        lock = (self.root / ".readflix-deploy.lock").open("w")
        self.addCleanup(lock.close)
        deploy.fcntl.flock(lock, deploy.fcntl.LOCK_EX | deploy.fcntl.LOCK_NB)
        arguments = ["deploy.py", "--path", str(self.root), "--compose", str(self.candidate_file), "--sha", SHA]
        with patch.object(deploy.sys, "argv", arguments):
            with self.assertRaisesRegex(deploy.DeployError, "host lock"):
                deploy.main()
        self.assertEqual(self.docker.calls, [])

    def test_termination_during_backup_recovers_old_backend(self):
        handlers = {}
        def register(signum, handler):
            handlers[signum] = handler
        def interrupt_backup(_data, _destination):
            handlers[deploy.signal.SIGTERM](deploy.signal.SIGTERM, None)
        arguments = ["deploy.py", "--path", str(self.root), "--compose", str(self.candidate_file), "--sha", SHA]
        with patch.object(deploy.sys, "argv", arguments), \
                patch.object(deploy.signal, "signal", side_effect=register), \
                patch.object(deploy, "backup_data", side_effect=interrupt_backup):
            with self.assertRaisesRegex(deploy.DeployError, "interrupted"):
                with contextlib.redirect_stdout(io.StringIO()):
                    deploy.main()
        self.assertTrue(self.docker.running)
        self.assertIn(("docker", "start", "readflix-backend"), self.docker.calls)
        self.assertEqual(self.live.read_text(), "# exact original compose\n")
        self.assert_original_data()

    def test_archive_never_follows_data_symlinks(self):
        (self.data / "linked-book").symlink_to(self.data / "books" / "private title.epub")
        with self.assertRaises(deploy.DeployError):
            deploy.backup_data(self.data, self.root / "archive.tar")
        self.assertFalse((self.root / "archive.tar").exists())


if __name__ == "__main__":
    unittest.main()
