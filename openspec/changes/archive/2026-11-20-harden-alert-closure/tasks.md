# Tasks

## 1. Backend tests

- [x] 1.1 Add `AlertLifecycleJourneyTest`: start, pick, end, restore via `current`, late pick refused with 409 and nothing stored, new alert starts with no responses
- [x] 1.2 Add `AlertResourceTest` (unit): an ended alert snapshot has status ended, `ended_at` and keeps all responses
- [x] 1.3 Run `php artisan test` (never `migrate:fresh --env=testing`)

## 2. Frontend resync

- [x] 2.1 In `useAlert`, extract one `resync()` that fetches the current alert, applies it and ignores its own errors
- [x] 2.2 Make `pick` and `end` call `resync()` and rethrow when the API answers 409
- [x] 2.3 Call `resync()` on `visibilitychange` (visible) and `online`, and remove the listeners on unmount

## 3. Frontend tests

- [x] 3.1 `useAlert.test.tsx`: 409 on pick and on end resync, visible and online resync, hidden does not, listeners removed on unmount, resync failure is silent
- [x] 3.2 `AlertSection.test.tsx`: the modal closes after a refused pick on an ended alert, and an administrator's refused end shows the ended board
- [x] 3.3 Run lint, tests and build in `frontend`

## 4. Docs

- [x] 4.1 Update README, `docs/WALKTHROUGH.md` and `docs/WALKTHROUGH.pt-BR.md` (item 6, decisions and why)
