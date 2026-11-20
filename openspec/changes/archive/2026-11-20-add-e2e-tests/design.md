# Design

## Context

The app is single-origin: the browser talks only to Vite (`:5173`), which proxies `/api`, `/sanctum`, `/storage` and the Reverb WebSocket. Mailpit exposes an HTTP API on `:8025`. Playwright and Chromium are already available on the host (Chromium cached under `~/.cache/ms-playwright`). Seeded accounts (`admin@example.com`, `user@example.com`, others) use the password `password`. There is only one development database; see proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Real two-session journeys matching the item 8 demo.
- Deterministic and repeatable against the dev stack without cleanup scripts the user must remember.

**Non-Goals:**
- No separate E2E database or stack (would double the compose file for little gain).
- No cross-browser matrix; Chromium only.
- No visual-regression or load tests.

## Decisions

- **Separate `e2e/` package, not inside `frontend/`.** Keeps Vitest, `tsc -b` and oxlint untouched and keeps Playwright's dependency tree out of the app. Alternative: add it to `frontend/`; rejected because Vitest would try to pick up spec files.
- **Run from the host, against `localhost:5173`.** The containers are Alpine (no Chromium); the host already has it. `baseURL` is configurable via `E2E_BASE_URL`, Mailpit via `E2E_MAILPIT_URL`.
- **Serial single worker.** There is one global "current alert" and one chat room, so parallel tests would interfere. `workers: 1`, tests in a file share state deliberately and are ordered as a journey.
- **Data safety instead of a reset.** `beforeAll` signs in as admin through the API and ends any active alert; chat text includes a run id; `afterAll` ends the alert; the password-recovery test uses a dedicated seeded account and resets the password back to the original through a second recovery flow, in a `finally`. Never touches migrations.
- **Offline simulation with `context.setOffline(true)`** plus closing nothing: this drops the WebSocket and fetches, and going online triggers the app's `online` resync and Echo reconnect.
- **Direct-request permission checks use Playwright's `request` fixture authenticated by the user's context** (cookies + CSRF from `/sanctum/csrf-cookie`), so they prove the server, not the UI.
- **Locators by role and label,** the same accessible names the Testing Library tests use, so UI renames fail loudly in both suites.
- **Optional stage in `scripts/test.sh`.** Alternative: always run; rejected because it needs a browser and writes demo data.

## Risks / Trade-offs

- [Flaky real-time assertions] → use Playwright auto-waiting `expect` with explicit timeouts, never fixed sleeps.
- [Password left changed if the run is killed mid-test] → documented one-liner to restore via the seeder (`php artisan db:seed`, idempotent) in the README.
- [Browser binary missing] → config falls back to a documented `PLAYWRIGHT_BROWSERS_PATH` / `npx playwright install chromium` step.
