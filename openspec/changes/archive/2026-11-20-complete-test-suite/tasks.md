# Tasks

## 1. Backend gap tests

- [x] 1.1 Add `tests/Feature/SeederTest.php`: roles, single rows after two runs, login with the demo password. Verify: `docker compose exec backend php artisan test --filter=SeederTest` passes.
- [x] 1.2 Add the 429 throttle case to `tests/Feature/Chat/PostMessageTest.php` (31st post refused, nothing stored). Verify with `--filter=PostMessageTest`.
- [x] 1.3 Add a 403 case for `GET /alerts/current` without an alert ability in `tests/Feature/Alerts/CurrentAlertTest.php`. Verify with `--filter=CurrentAlertTest`.
- [x] 1.4 Add unit tests `SquareTest`, `UserRoleTest`, `AlertStateTest` in `tests/Unit`. Verify with `--testsuite=Unit`.

## 2. Frontend gap tests

- [x] 2.1 `auth/AuthProvider.test.tsx`: initial check (signed in / visitor), login, logout, 401 clears user, failed login rethrows. Verify with `npx vitest run src/auth`.
- [x] 2.2 `components/AppLayout.test.tsx` and `components/UserAvatar.test.tsx`: navigation, sign out, role chip, picture vs initial. Verify with vitest.
- [x] 2.3 `pages/errors.test.ts` and forgot-password failure cases in `pages/pages.test.tsx`. Verify with vitest.

## 3. One-command runner and docs

- [x] 3.1 Add `scripts/test.sh` (backend, frontend, lint, type-check; summary; non-zero on failure; no migrate commands). Verify: run it green, then break a test temporarily to see exit 1 and all stages still run.
- [x] 3.2 Update README "Tests and checks" and both walkthroughs with the coverage map, how to run, and the design decisions. Verify: commands in docs run as written.

## Workflow follow-up

- Run the full suite, archive the change (`/opsx:archive`), open the PR.
