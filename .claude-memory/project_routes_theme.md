# Readflix navigation and appearance (2026-10-06)

- Feature branch: feat/routes-device-theme. Base e01686d. Release 1.1.1.
- Main push automatically publishes containers and deploys. The user explicitly authorized this Readflix release via existing GitHub CI/CD on 2026-10-06; do not add another permission gate. Never create credentials or widen host permissions.
- Route inventory and acceptance: openspec/changes/routes-device-theme/.
- Device appearance lives in `readflix.appearance` localStorage (light/dark/system); optional `readflix.reading-paper` is local too. Never apply the API settings theme or send theme in layout updates. `index.html` bootstraps color before React.
- Selected reader ID is sessionStorage `readflix.reader`; validate against users API on refresh, preserve safe returnTo URL. Selection is the existing shared-household model, not authentication. No new security claims.
- Reader fetches URL book + per-reader progress before renderer mounts. Do not reset the renderer for panel queries. EPUB restore suppresses interim first-page saves and publishes the settled position once, including fresh books.
- Ordered progress writes plus per-reader/book pending local recovery prevent navigation/offline races. Remove the recovery value only after matching write acknowledgement. Clear-progress awaits pending writes.
- QA used owned ego-browser TaskSpace 29, then review follow-up space 30 after 29 was finished and /tmp/readflix-route-theme-qa only. Node 24.18.0 supports existing SQLite; Node 26 does not. No real books or live readers were changed.
- Independent review and fix verification completed with GPT-6 Astra xhigh. Tools did not expose/verify Fast tier. Three findings fixed: EPUB initial position, upload back/forward duplicate requests, trailing-slash panels. Review used eight targeted browser checks rather than repeating all 54 checks.
- Upload batches are keyed by selected files, independent of route visibility; completing/dismissing a background batch must not redirect from other routes.
- Deployment uses the existing GitHub secrets/identity; Mac SSH is not a release prerequisite. Confirm host mount, backup and old images inside the deployment transaction; abort before replacement on a failed preflight. Keep private host topology and backup paths in local handoff evidence, not the public repo.
- Reported live screenshot was the old fixed 1126px root/white canvas plus hardcoded dark library. Whole-viewport theme and aligned header replace it. Continue/saved shelves now preview two compact cards each and link to their complete routed lists.

- Global openspec-protection pre-push hook forbids publishing OpenSpec changes. Keep this task's new openspec change/evidence local; implementation commit excludes it. Do not disable hooks.
