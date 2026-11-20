# Design

## Context

The server already makes closing safe: `AlertController::end` and `AlertResponseController::store` lock the alert row (`lockForUpdate`) so a pick and an end are serialised, a pick on an ended alert is a 409, and `GET /api/alerts/current` returns the latest alert whether active or ended. The client (`useAlert`) loads on mount, applies live snapshots through `applySnapshot` (revision guard) and refetches after a WebSocket reconnect. The gaps are all on the client plus missing end-to-end tests.

## Goals / Non-Goals

**Goals:**
- A client never stays stuck on a state the server has already left.
- Prove the complete lifecycle with one backend journey test.

**Non-Goals:**
- No change to endpoints, schema, events or the channel.
- No polling timer, no service worker, no offline queue.

## Decisions

1. **Resync on 409 inside `useAlert`, not in the components.** `pick` and `end` catch an `ApiError` with status 409, refetch `getCurrentAlert()` and apply it through `applySnapshot`, then rethrow so the caller can still show the message. The hook already owns all API and socket traffic, so the components stay presentational. Alternative: resync in `AlertModal`. Rejected: it would duplicate the fetch logic and the modal would need the API.
2. **Single `resync()` function reused by every trigger.** Reconnect, 409, `visibilitychange` (only when `document.visibilityState === 'visible'`) and `online` all call the same `load`-style function that swallows its own errors. One code path means one place to test and no divergent behaviour.
3. **Reuse `applySnapshot`.** The revision guard makes a resync idempotent and safe against a live event racing it: a stale response can never overwrite a newer one.
4. **Tests are the only backend change.** The behaviour is already correct; a journey test pins it, and a unit test pins that the ended snapshot keeps its responses (that is what recovery relies on).

## Risks / Trade-offs

- Extra GETs on focus and online: negligible, one small request per event, and no timer.
- A 409 for a reason other than "ended" (for example the user already picked) also triggers a resync. That is harmless and even useful: it shows the already stored pick.
