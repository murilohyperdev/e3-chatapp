# Proposal

## Why

Item 6 of the exercise asks that an administrator can end an alert, that both sessions update, that late submissions are rejected, and that a refresh, reopen or reconnect restores the true state, including an alert that ended while a session was disconnected. The server side of this already exists (end endpoint, 409 on late picks, `GET /api/alerts/current` returning ended alerts, catch-up after a WebSocket reconnect). An audit found three gaps that break the promise in realistic cases.

## What Changes

- A client with stale state that sends a pick or an end and gets a 409 now resynchronises from `GET /api/alerts/current` instead of only showing an error. Today a user whose socket dropped, and who missed the end, stays stuck in the modal.
- The client also resynchronises when the browser tab becomes visible again and when the browser reports it is back online, because a sleeping laptop or a mobile tab can hold a socket that looks connected but missed events.
- Add an end-to-end backend feature test of the whole lifecycle (start, pick, end, restore, late pick refused, new alert starts empty) and a unit test that an ended alert snapshot keeps its responses.
- No new endpoints, no migrations, no change to the API contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `alert-lifecycle`: restoring the current state is also guaranteed after a full lifecycle, and a late pick never changes a stored alert.
- `alert-realtime`: catch-up is also triggered by a 409 on pick or end, by the tab becoming visible and by the browser going back online.
- `alert-page`: a refused pick or end on an alert that has already ended closes the modal and shows the ended board.

## Impact

- Backend: tests only (`tests/Feature/Alerts/AlertLifecycleJourneyTest.php`, `tests/Unit/AlertResourceTest.php`). No production code.
- Frontend: `src/alerts/useAlert.ts` (resync on 409, `visibilitychange`, `online`), tests in `useAlert.test.tsx` and `AlertSection.test.tsx`.
- Docs: README, `docs/WALKTHROUGH.md` and `docs/WALKTHROUGH.pt-BR.md`.
