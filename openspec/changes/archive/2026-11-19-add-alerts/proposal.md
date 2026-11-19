# Proposal

## Why

The chat exists, but the exercise's point is an emergency flow: an administrator raises an alert and every connected person says where they are. Today nothing can start an alert, collect locations or show them to everyone. The abilities (`start-alerts`, `end-alerts`, `receive-alerts`, `submit-locations`, `view-locations`) and the real-time transport already exist; this change gives them behavior.

## What Changes

- Add alerts: an administrator (`start-alerts`) starts one; at most one alert can be active at a time, enforced by the database.
- Add location responses: every user (the starter included) picks one of four labeled squares (A to D, shown as a 2x2 grid). The first pick is final; there is one response per user per alert, enforced by the database. Several users may pick the same square.
- Deliver alert state live over a new private channel `alerts`: when an alert starts, every open session gets a modal asking for a square; when anyone picks, every session shows that person's name inside the chosen square.
- Add the basic "end alert": an administrator (`end-alerts`) ends the active alert; later picks are rejected. A new alert always starts empty.
- Persist everything and serve it with `GET /api/alerts/current`, so a refresh or reconnect restores the alert (including one that ended while the session was offline).
- Show the modal and a shared board on the main page. Chat keeps working during an alert.

## Capabilities

### New Capabilities
- `alert-lifecycle`: starting and ending alerts, the single-active-alert rule, and restoring the current state.
- `alert-locations`: picking a square, one final response per user per alert, and who may submit.
- `alert-realtime`: live delivery of alert state over a private channel only permitted users can join, with catch-up after a lost connection.
- `alert-page`: the modal, the 2x2 board with names, and the admin start/end controls on the main page.

### Modified Capabilities

None. Chat specs are unchanged on purpose: alerts use their own channel.

## Impact

- Backend: `alerts` and `alert_responses` migrations, `Alert`/`AlertResponse` models and factories, `Square` enum, `AlertController`, `AlertResponseController`, form request, `AlertResource`, `AlertChanged` broadcast event, `routes/channels.php`, `routes/api.php`, tests.
- Frontend: alerts API helpers, `subscribeToAlerts` in `lib/echo.ts`, `useAlert` hook, `AlertModal`, `AlertBoard`, `HomePage` change, tests.
- Docs: README, both walkthroughs.
- Out of scope (item 6 and beyond): changing a pick after submitting, per-user visibility rules beyond the existing abilities, alert history/listing, notifications outside the page, dismissing an old ended alert, custom square labels.
