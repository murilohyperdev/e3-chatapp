# Design

## Context

Auth is Sanctum cookie mode; abilities are Gates built from `UserRole::abilities()`; the five alert abilities already exist (administrator has all, user has all but start/end). Chat uses Laravel Reverb + Echo on the private channel `chat`, with `useChat` merging by id and refetching after reconnect. PostgreSQL 17 is the only database (dev and tests), so Postgres-specific constraints are allowed. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** the invariants (one active alert, one response per user per alert, valid square) live in the database, not only in PHP; every client converges on the same state after any mix of events, reloads and reconnects; item 6 (end rules, restore) needs no schema or protocol change.

**Non-Goals:** editing a pick, alert history screens, per-user payloads, queues, more than four squares or custom labels.

## Decisions

1. **Two tables.** `alerts`: `id`, `started_by` (FK users, restrict-on-delete is not needed: `nullOnDelete`, so history survives a deleted admin), `ended_by` (nullable FK, `nullOnDelete`), `ended_at` (nullable), `revision` (unsigned int, default 1), timestamps. `alert_responses`: `id`, `alert_id` (FK cascade), `user_id` (FK cascade), `square` (string(1)), timestamps. "Active" is derived from `ended_at IS NULL`; a separate `status` column would be a second source of truth that can disagree with the timestamp.
2. **Constraints in the database.**
   - One active alert: partial unique index `CREATE UNIQUE INDEX alerts_single_active ON alerts ((true)) WHERE ended_at IS NULL`. Every active row maps to the same constant key, so a second one violates it. Alternative (a check in PHP, or a lock) is racy: two requests can both see "none active". The controller catches `UniqueConstraintViolationException` and answers 409.
   - One response per user per alert: `UNIQUE (alert_id, user_id)`; the same catch gives 409. The unique index also serves lookups by alert.
   - Valid square: `CHECK (square IN ('a','b','c','d'))` plus a PHP backed enum `Square` for validation and typing, so bad data cannot get in by any route (seeders, tinker).
3. **Squares are a fixed enum, labels live in the client.** The server only knows `a`-`d`; the UI maps them to "Square A" to "Square D". Alternative (a `squares` table) adds joins and an admin screen nobody asked for.
4. **Endpoints**, all under `auth:sanctum`, each protected by the existing Gates through `can:` middleware so a direct request is refused before the controller runs:
   - `POST /api/alerts` (`can:start-alerts`) → 201 snapshot, or 409.
   - `GET /api/alerts/current` (`can:receive-alerts`, `can:view-locations`) → `{data: snapshot|null}`, the latest alert by id (active or ended).
   - `POST /api/alerts/{alert}/responses` (`can:submit-locations`) body `{square}` → 201 snapshot, 409 if ended or already answered, 422 if invalid. POST (create), not PUT, because the first pick is final and a second one is a conflict.
   - `POST /api/alerts/{alert}/end` (`can:end-alerts`) → 200 snapshot, or 409 if already ended.
   Reading and joining the channel require both `receive-alerts` and `view-locations` because the payload contains who is where; this keeps one payload for everyone (a broadcast cannot be filtered per user).
5. **Race-safe writes in a transaction with a row lock.** Submitting a response and ending an alert both start with `Alert::lockForUpdate()` on the alert row inside `DB::transaction`. A pick therefore either commits before the end or sees `ended_at` set and gets 409; it can never be stored after the end. Both then `increment('revision')` and are committed before the broadcast (`afterCommit`/explicit after the transaction), so listeners never see an event for a change that rolls back.
6. **Full snapshots, not deltas, plus a revision.** Every event and every HTTP response is the same `AlertResource`: `id`, `status` (`active|ended`), `revision`, `started_at`, `ended_at`, `started_by {id,name}`, `responses [{user {id,name,avatar_url}, square}]`. The client replaces its state when `alert.id` is newer or the id is equal and `revision` is greater-or-equal; otherwise it ignores it. Alternative (deltas such as "user X picked b") needs ordering and gap detection, and reconnect would still need a refetch. Snapshots make every message idempotent, so duplicate, late or reordered delivery cannot corrupt the view, and the reconnect path is just `GET /current`. Size is tiny (a handful of users).
7. **One event `AlertChanged`, broadcast to everyone.** `ShouldBroadcastNow` on `PrivateChannel('alerts')`, `broadcastAs()` = `alert.changed`, payload = the resource. No `toOthers()`: the idempotent snapshot makes the echo to the sender harmless and it keeps one code path (the sender's UI is driven by the same event as everyone else's). Broadcast failures are caught and reported after the data is stored, like chat, so a Reverb outage never loses a pick.
8. **Channel `alerts`.** Authorised by `Gate::allows('receive-alerts') && Gate::allows('view-locations')`. A separate channel keeps chat untouched and lets a different permission rule apply.
9. **Frontend.** `api/alerts.ts` (calls, types), `subscribeToAlerts` next to `subscribeToChat` in `lib/echo.ts` (same connection, same status mapping), and a `useAlert` hook that is the only code touching them: loads `/current`, subscribes, applies snapshots through a pure `applySnapshot(current, incoming)` function (the revision rule above), refetches when the connection returns, and exposes `start`, `end`, `pick`. `AlertModal` (MUI `Dialog`, `disableEscapeKeyDown`, no backdrop close) opens when `status === 'active'`, the user may submit and has no response; `AlertBoard` renders the 2x2 grid and names; both are presentational. `HomePage` composes them above `ChatPanel`, so chat stays usable. Mounting `useAlert` once in `HomePage` (not inside the modal) keeps the subscription alive whether or not the modal is open.
10. **Seed/demo and docs.** No seed data: alerts are created through the app. README and both walkthroughs get the new endpoints, the constraints and the two-session manual test.
11. **Testing.** Backend feature tests per endpoint (success, validation, 401, 403 for the wrong role through direct requests, 409 cases), constraint tests that bypass PHP and insert duplicates through the query builder to prove the database refuses them, a resource/shape test, event tests with `Event::fake`, a channel-authorisation test, a broken-broadcaster test. Unit tests for `Square` and the Gate/role map. Frontend tests for `applySnapshot`, `useAlert` with a fake Echo (live start, live pick, stale ignored, reconnect refetch), `AlertModal`, `AlertBoard` and `HomePage` role-based controls.

## Risks / Trade-offs

- [Partial unique index on `(true)` is Postgres-specific and hides intent] → Documented in the migration and walkthrough; the project is Postgres-only and a feature test proves it works.
- [Revision rule could drop a legitimate snapshot if ids restart] → ids are autoincrement and never reused; the rule compares id first.
- [Everyone with the two abilities sees all names; no per-user filtering] → Intentional per the brief (names are shown to all sessions).
- [`ShouldBroadcastNow` makes the request wait for Reverb] → same accepted trade-off as chat; errors are caught and logged.
- [An old ended alert keeps showing on the board] → Accepted for this change; dismissing/hiding old alerts belongs to item 6.

## Migration Plan

Additive migrations only. Roll back with `migrate:rollback` (drops `alert_responses` then `alerts`). No data migration.
