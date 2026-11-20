# Tasks

## 1. Package and helpers

- [x] 1.1 Create `e2e/` (`package.json`, lockfile, `playwright.config.ts` with one worker, baseURL from env, Chromium). Verify: `cd e2e && npx playwright test --list` runs without error.
- [x] 1.2 Add helpers: `signIn(page, email)` through the UI, API client with CSRF for direct requests, `endActiveAlert`, Mailpit helpers (clear inbox for a recipient, wait for the reset email, extract the link). Verify: used by the scenarios below.

## 2. Journeys

- [x] 2.1 `journey.spec.ts`: chat delivery both ways without refresh. Verify: `npx playwright test journey` green.
- [x] 2.2 Same file: alert start delivered live, modal, pick shown on both boards, user has no admin controls, admin ends, user sees ended. Verify: green.
- [x] 2.3 `permissions.spec.ts`: direct API start/end as user 403 and nothing created, visitor 401 on current alert and messages. Verify: green.
- [x] 2.4 `recovery.spec.ts`: reload keeps pick without reopening the modal; offline during end, then online shows ended. Verify: green.
- [x] 2.5 `password.spec.ts`: full reset through Mailpit, old password refused, password restored in `finally`. Verify: green and the demo password works afterwards.

## 3. Integration and docs

- [x] 3.1 Add `--e2e` to `scripts/test.sh` (skipped line in summary otherwise). Verify: with and without the flag, and a failing e2e gives exit 1.
- [x] 3.2 Update README and both walkthroughs (what each journey proves, data-safety rules, how to run). Verify: commands run as written; run the whole suite twice to prove repeatability.

## Workflow follow-up

- Archive the change (`/opsx:archive`), commit, open the PR.
