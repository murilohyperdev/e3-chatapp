# Proposal

## Why

Item 8 of the exercise is a live demonstration with two independent sessions logged in as different user types. Unit and feature tests prove each piece, but nothing proves the pieces work together in real browsers: WebSocket delivery through the Vite proxy, the alert modal, reload recovery, and the password-reset email link. Automating that journey makes the demo repeatable and catches integration bugs that component tests with fakes cannot.

## What Changes

- New root package `e2e/` with Playwright tests that drive real Chromium against the running Docker stack (frontend `:5173`, Mailpit API `:8025`).
- Scenarios, each using two independent browser contexts (administrator and regular user): chat delivery without refresh, alert start delivered live, location pick visible on both boards, permission enforcement (no admin controls in the UI; direct API calls 403, visitor 401), ending an alert, reload recovery, offline/online reconnection including an alert that ended while offline, and password recovery through the email link read from Mailpit.
- The tests are safe for the development database: unique message text, any active alert is ended first, changed passwords are restored, and nothing runs migrate commands.
- `scripts/test.sh --e2e` adds the end-to-end stage; it stays off by default because it needs a browser and writes demo data.
- README and both walkthroughs explain how to run it and why it is built this way.

## Capabilities

### New Capabilities
- `e2e-tests`: the browser-level journeys the suite must prove, and the safety rules for running them against the development stack.

### Modified Capabilities

(none)

## Impact

- New `e2e/` directory (Playwright dev dependency, its own lockfile); no change to `backend/` or `frontend/` runtime code.
- `scripts/test.sh` gains an optional flag; README and walkthroughs updated.
- Writes a few chat messages and one alert (ended again) to the development database on each run.
