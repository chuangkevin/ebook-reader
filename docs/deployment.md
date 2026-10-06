# Readflix releases

The existing GitHub Actions pipeline builds both ARM64 images on `main`. It publishes
`sha-<full commit SHA>` tags and retains `latest` for compatibility. Deployment checks
out the build's `workflow_run.head_sha`, pulls that SHA pair, and records the resolved
image IDs. The installed Compose configuration pins those IDs. A manual deployment
on `main` requires that both images for its current SHA already exist.

Deployment is serialized by the workflow concurrency group and a non-blocking lock
inside the existing deployment directory. Existing Tailscale OAuth and `DEPLOY_*`
secrets provide connectivity and the target path. The SSH workflow keeps its existing
`ssh-keyscan` setup and requires host-key checking. It does not add credentials or
change the host's authentication configuration.

The host needs Python 3.9+, Docker with the Compose plugin (`config --format json` and
`up --pull never`), and permission for the deployment account to read all application
data. The frontend image provides `wget`; the backend image provides Node. No new
host package is installed automatically.

## Transaction and recovery

`scripts/deploy.py` requires an existing deployment with both services running. It:

1. Reads the live Compose configuration and the containers' actual project labels,
   image IDs, and writable `/app/data` bind mount. The mount must resolve to the
   deployment directory's `data` directory and contain `db/ebook-reader.sqlite`.
   Missing data, unexpected services, changed networks, symlinks/special files in
   data, or changed container identities fail before stopping the backend.
2. Saves the original Compose file, a resolved rollback configuration pinned to the
   old image IDs, and local retention tags for both old images.
3. Pulls both SHA-tagged images, verifies ARM64, and checks free backup space again.
   The uncompressed archive estimate includes file overhead, 10% margin and a
   512 MiB free-space reserve. A failed pull leaves the current services running.
4. Stops the backend with a 60-second grace period. A forced kill, OOM, or nonzero
   exit aborts the backup and restarts the original backend.
5. Archives the entire stopped backend data directory, including SQLite, WAL/SHM
   files when present, books and covers. It verifies every archived file against
   the quiescent source and writes an archive SHA-256 checksum. Files and archive
   contents stay on the server. Application data and logs are not uploaded to CI.
6. Atomically replaces the live Compose file and recreates the existing services
   under their original Compose project. It does not run `down`, remove networks,
   remove unrelated containers, prune images, or migrate data.
7. Verifies both expected image IDs, container state/health, backend `/health` and
   frontend `/`. Only then does it mark the release verified.

A failure while the backend is stopped restarts it. A failure after replacement
restores the original Compose file and recreates both services using the saved
old image IDs. Recovery gets the same health checks and retains the current data.
**It never automatically restores the archive**, so writes accepted by the new
release survive rollback. This release process therefore assumes compatible data
formats; schema-changing releases need a separately reviewed migration plan.

Catchable termination/disconnect signals also enter recovery. Power loss, `SIGKILL`,
a failed Docker daemon, or failed recovery health checks require manual recovery.
A failing workflow remains failed even when automatic recovery succeeds.

## Server-local recovery material

Each attempt keeps `.readflix-releases/<timestamp>-<sha-prefix>/` inside the deployment
directory. It contains `previous-compose.yml`, `rollback-compose.json`, `receipt.json`,
the prepared release configuration, and, when backup completed, `data.tar` and its
checksum. A `verified` file identifies a completed successful release. Files are
private to the deployment account; they may contain resolved application settings.
Public staging files remain in `.readflix-stage-<run>-<attempt>/`.

No automatic retention deletion runs. Review disk usage and retain/delete individual
old application recovery points only under an explicit retention policy. A full disk
preflight stops a release before service shutdown. Do not prune the rollback tags
until their corresponding recovery point is no longer needed.

For manual container recovery, an operator can use the chosen recovery directory's
`rollback-compose.json` with `docker compose --project-directory <deploy-path>
--project-name <project-from-receipt> -f <rollback-compose.json> up -d --pull never
--no-build`. The original raw Compose is also retained. Investigate archive/data
recovery on the server; restoring data is a separate explicit operation.

## Local verification

```sh
python3 -m unittest discover -s tests/deployment -v
python3 -m py_compile scripts/deploy.py tests/deployment/test_deploy.py
```

The tests use isolated temporary data and a simulated Docker host. They exercise
backup contents, preflight refusals, partial stop and archive failures, image-pinned
rollback, both HTTP failures, rollback failure, and preservation of post-release
writes. They do not replace validation of the GitHub workflow and the actual host.
