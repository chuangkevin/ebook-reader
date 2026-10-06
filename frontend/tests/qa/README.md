# Readflix route/theme QA

These scripts use **ego-browser**, not an additional browser instance. Use one owned TaskSpace for the goal; replace the recorded space/page IDs before a fresh run. Scripts are stateful integration checks against synthetic local data, not tests for production accounts.

1. Check ports 3003/5173 first. Use Node 24 for the current better-sqlite3 version. Start the backend with an **empty isolated** `DB_PATH`, `BOOKS_DIR`, `COVERS_DIR` under `/tmp/readflix-route-theme-qa`. Never reuse personal data. The seed refuses nonempty APIs.
2. Build backend, start `backend/dist/server.js` with those environment variables and `PORT=3003`. Start the frontend on 127.0.0.1:5173. The existing Vite proxy targets 3003.
3. Run `python3 frontend/tests/qa/seed-local.py` once. It creates two synthetic readers, three EPUBs, three text books and a three-page PDF, plus seed progress.
4. Create an ego-browser TaskSpace, use its p1 to select `閱讀測試`, and set script TaskSpace IDs. Run `ego-browser nodejs < frontend/tests/qa/navigation-theme.mjs`.
5. `device-recovery.mjs` creates p2 and tests reader gating, bootstrap without React, system/explicit theme, storage denial, reader isolation, offline recovery and theme-free layout API payloads. Restore the clean seed state before re-running the full suite (tests intentionally change synthetic reading positions).
6. `states.mjs` reuses p2 and injects page-scoped empty/error responses. It does not change API data.
7. Screenshots and JSON reports go under `/tmp/readflix-route-theme-qa`; inspect screenshots, not only the assertions. Finish the owned TaskSpace exactly once after all checks.

Local evidence is copied to `openspec/changes/routes-device-theme/evidence` for this change. The global OpenSpec protection hook keeps that folder out of the publishable implementation commit. Browser viewport emulation does not claim physical-device, Safari or separate-profile coverage. PDF pages intentionally retain original colors.

`review-regressions.mjs` covers the independent review findings on a fresh synthetic seed: unopened EPUB bookmark, pending EPUB display/write restoration, trailing-slash routes and filtered return, and a stalled four-file upload across history navigation. It holds local XHR sends before releasing them and checks exactly four requests. Use the same owned TaskSpace after updating its recorded ID. Do not reseed a running/nonempty database to rerun it.
