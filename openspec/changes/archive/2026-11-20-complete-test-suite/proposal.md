# Proposal

## Why

Exercise item 7 asks for "all relevant unit and feature tests covering successful operations and failure conditions", and the live review requires running them on demand. The suite is already large (144 backend, 98 frontend tests), but an audit against the code found real holes, and running everything today means remembering three separate commands.

## What Changes

- Backend tests for behaviour that has none: the demo seeder (two accounts with the right roles, idempotent, able to sign in), the 30/min throttle on `POST /messages` (429), and `GET /alerts/current` refusing a signed-in user who lacks an alert ability (403).
- Backend unit tests for pure domain pieces: `Square`, `UserRole::can`, `Alert::isActive` and the `active` scope.
- Frontend tests for untested modules: `AuthProvider` (session check, login, logout, 401 handling), `AppLayout`, `UserAvatar`, `pages/errors.ts`, and the failure paths of the forgot-password page.
- One command, `scripts/test.sh`, that runs backend tests, frontend tests, lint and type-check, stops with a clear summary, and never touches the development database.
- README "Tests and checks" section and both walkthroughs explain what is covered and how to run it.

## Capabilities

### New Capabilities
- `test-suite`: what the automated suite must cover (success and failure paths per feature) and how it is run with a single command, safely.

### Modified Capabilities

(none: no application behaviour changes)

## Impact

- New files only under `backend/tests`, `frontend/src/**/*.test.*`, `scripts/`, plus docs (`README.md`, `docs/WALKTHROUGH*.md`).
- No production code changes unless a test exposes a bug (then fixed and noted).
- No new dependencies.
