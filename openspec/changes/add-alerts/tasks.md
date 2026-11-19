# Tasks

## 1. Database and models

- [x] 1.1 Add the `alerts` and `alert_responses` migrations with the partial unique index (one active alert), `UNIQUE(alert_id,user_id)` and the square CHECK; add `Square` enum, `Alert`/`AlertResponse` models (fillable only what is safe) and factories; verify with feature tests that duplicates are refused by the database itself (raw inserts) and that a second alert can start after one ends.

## 2. Alert API

- [x] 2.1 Add `AlertResource`, `AlertController@current` and `GET /api/alerts/current`; verify: latest alert active or ended with responses, `data: null` when none, 401 visitor, 403 without abilities.
- [x] 2.2 Add `POST /api/alerts` (`can:start-alerts`); verify: admin 201 with empty responses, regular user 403 and nothing created, visitor 401, second active alert 409, new alert after end starts empty.
- [x] 2.3 Add `POST /api/alerts/{alert}/responses` with `StoreAlertResponseRequest` (transaction, row lock, revision bump); verify: valid pick 201, shared square, invalid/missing square 422, repeat 409 unchanged, ended alert 409, 403 without `submit-locations`, 401 visitor, new alert allows a new pick.
- [x] 2.4 Add `POST /api/alerts/{alert}/end` (`can:end-alerts`); verify: admin 200 with ended state and responses kept, already ended 409, regular user 403 and alert still active, pick after end rejected.

## 3. Real time

- [x] 3.1 Add the private `alerts` channel in `routes/channels.php` and the `AlertChanged` event (`alert.changed`, snapshot payload), dispatched after commit by start, pick and end with errors logged not thrown; verify with `Event::fake`: dispatched on `private-alerts` with the resource payload, not dispatched on any rejected request, request still succeeds when the broadcaster throws, channel authorised for permitted users and refused for visitors and users lacking either ability.

## 4. Frontend

- [x] 4.1 Add `api/alerts.ts`, `subscribeToAlerts` in `lib/echo.ts` and the pure `applySnapshot`; verify with unit tests: newer alert wins, higher revision wins, stale ignored, same revision idempotent.
- [x] 4.2 Add the `useAlert` hook (load current, live updates, refetch on reconnect, `start`, `end`, `pick` with error surfaced); verify with hook tests using a fake Echo: live start/pick/end, stale ignored, reconnect picks up an alert that ended while offline.
- [x] 4.3 Add `AlertModal` and `AlertBoard` and wire them with admin start/end controls into `HomePage`; verify with component tests: modal opens automatically and cannot be dismissed, closes after pick, shows server error and stays, not shown after picking or without `submit-locations`, board lists names (several in one square), ended notice, buttons per role, chat still rendered; then `npm test`, `npm run build`, `npm run lint`.

## 5. Docs and end-to-end check

- [x] 5.1 Update the README (endpoints, channel, event contract, constraints); run `php artisan test`, pint and a manual two-session check (administrator + user): modal appears live, names appear live in the chosen square, second pick refused, end stops picks, refresh restores state, new alert starts empty.
- [x] 5.2 Update `docs/WALKTHROUGH.md` and `docs/WALKTHROUGH.pt-BR.md` explaining the code and the reason for each decision, with the manual test steps.

## Workflow follow-up

- [ ] Archive the change with `/opsx:archive` after the work is merged-ready.
