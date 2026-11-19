# Design

## Context

Auth uses Sanctum's cookie (SPA) mode and the browser only talks to the Vite origin, which proxies `/api`, `/sanctum` and `/storage` to Laravel. The `send-messages` ability already exists. The backend image already has `pcntl`, which the WebSocket server needs. Item 5 (alerts) will push events to open browsers too, and chat must keep working while an alert is active. See proposal.md.

## Goals / Non-Goals

**Goals:** messages persist; other sessions receive them live; only signed-in users can listen; the transport is reusable for alerts; works with a plain `docker compose up`.

**Non-Goals:** several rooms, direct messages, edit/delete, typing indicators, presence, horizontal scaling of the WebSocket server.

## Decisions

1. **Transport: Laravel Reverb + Laravel Echo (WebSockets).** Alternatives: (a) polling every few seconds: simplest, but wasteful, laggy and not really "real time"; (b) Server-Sent Events: one-way is enough for chat, but `php artisan serve` handles one request at a time and long-lived responses would block the API, and Laravel has no first-party SSE channel authorisation; (c) Pusher/Ably: hosted, needs an account and keys, unwanted for a self-contained exercise; (d) a Node socket.io sidecar: second language and a second auth system. Reverb is first-party, self-hosted, speaks the Pusher protocol (so `pusher-js` + Echo work), and authorises private channels through the same session as the API. Alerts will reuse the same connection, which is why one channel technology is chosen now.
2. **One private channel `chat`.** A single shared room needs a single channel. It is private (not public) so a visitor cannot listen. Authorisation callback: any signed-in user (`fn (User $user) => true`) because reading the room is allowed to everyone signed in; sending is the `send-messages` ability on the HTTP route. The channel is named for the room, not the feature, so alerts can add their own channels next to it and chat stays untouched during an alert.
3. **Channel authorisation over the Sanctum cookie.** `withBroadcasting(routes/channels.php, ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']])` exposes `POST /api/broadcasting/auth`, so it goes through the existing Vite `/api` proxy and uses the session cookie. Because the request is from a stateful domain, CSRF is checked: the Echo auth request carries `X-XSRF-TOKEN` read from the cookie at the moment of each request (a `headersProvider`, not a constant, so a rotated token is not stale).
4. **Data model.** Table `messages`: `id`, `user_id` (foreign key, cascade on delete, indexed), `body` (text), timestamps. Index on `created_at, id` is not needed beyond the primary key because history is paged by `id` (monotonic, unique, so it also orders ties). No soft deletes (no delete feature).
5. **API.** `GET /api/messages?before={id}` returns up to 50 messages with `id < before` (or the latest), newest-first query then reversed to chronological, plus `has_more`. Keyset (cursor) pagination, not offset: new messages arrive constantly, and offset pages would shift and duplicate rows. `POST /api/messages` with `can:send-messages` creates one. Both under `auth:sanctum`. `POST` has `throttle:30,1` to limit flooding.
6. **Validation.** `StoreMessageRequest`: `body` required, string, max 2000, trimmed (Laravel's `TrimStrings` middleware trims and converts empty to null, so a blank message fails `required`). The sender is set from `$request->user()`; `user_id` is not fillable, so it can't be forged.
7. **Event.** `NewMessage` implements `ShouldBroadcastNow` on `PrivateChannel('chat')`, event name `message.created`, payload is the same `MessageResource` array as the HTTP response (single contract). `ShouldBroadcastNow` instead of queued `ShouldBroadcast`: it removes the need for a queue worker process in Compose and makes delivery latency just one HTTP call to Reverb; the trade-off (the POST waits for that call) is acceptable at this scale and called out in Risks. The controller uses `broadcast(...)->toOthers()` so the sender, who already has the message from the HTTP response, does not receive it again (the `X-Socket-ID` header makes this work). The client also de-duplicates by message id as a second guard.
8. **Resource.** `MessageResource`: `id`, `body`, `created_at` (ISO 8601), `user` (`id`, `name`, `avatar_url`). It reuses `DirectoryUserResource`'s safe shape for the sender (minus role) so no private field can leak through the chat or the broadcast. History loads `with('user')` to avoid N+1.
9. **Reverb in Compose.** A `reverb` service from the backend image runs `php artisan reverb:start --host=0.0.0.0 --port=8080`. Laravel publishes events to it over the Compose network (`REVERB_HOST=reverb`). The browser connects to the Vite origin; Vite proxies the WebSocket upgrade path `/app` to `reverb:8080` (`ws: true`), so there is no second origin, CORS rule or exposed port to manage. The app key/secret are dev-only values in `.env.example`; the public key is passed to the frontend as `VITE_REVERB_APP_KEY`.
10. **Frontend structure.** `lib/echo.ts` creates the Echo instance lazily and tears it down on sign-out; `api/messages.ts` has the HTTP calls; a `useChat` hook owns state (messages, hasMore, connection state, send, loadOlder) and is the only place that touches Echo, so `ChatPanel` (presentational: list + composer) is testable with a fake hook/echo. State rules: merge by `id` (dedupe), keep sorted by `id`; on reconnect refetch the latest page and merge, which covers messages missed while offline.
11. **Required text element.** A `Box` with `fontSize: 1px`, `color: #fff`, the exact sentence, rendered on `HomePage`. Placed as plain text (not `display:none`) so it is actually "on the page". Tested by exact text match.
12. **Testing.** Backend: feature tests for post (valid/invalid/too long/blank/403/401/forged `user_id`), history (order, pagination, `has_more`, private fields, 401), broadcast (`Event::fake` asserts `NewMessage` on the private channel with the resource payload; no event on a failed post), channel authorisation (member OK, visitor refused), model/unit tests. Frontend: component and hook tests with a mocked Echo (receives live message, dedupes own message, reconnect refetch, disabled composer, error keeps text, hidden text present). A manual two-browser check closes the work.

## Risks / Trade-offs

- [`ShouldBroadcastNow` makes POST wait for Reverb, and a Reverb outage would fail it] → Broadcast errors are caught and logged after the message is stored, so the message is never lost and sender gets 201; clients catch up on reconnect/next load.
- [WebSocket server is a single process] → Fine for the exercise; Reverb supports Redis scaling if ever needed (documented, not built).
- [Echo `toOthers()` depends on the socket id header] → De-dupe by id on the client regardless.
- [Messages are plain text rendered by React] → React escapes output, so stored HTML is displayed as text, never executed; no `dangerouslySetInnerHTML`.
- [Spam] → Throttle on POST and a 2000-character cap.
- [Hidden white 1px text is invisible and not accessible] → Required by the brief; marked `aria-hidden` is NOT used so it stays real page text, and it carries no interactive content.

## Migration Plan

`composer install` (adds Reverb), `php artisan migrate`, `docker compose up -d` (starts `reverb`), copy new keys into `.env` (the entrypoint copies `.env.example` only on a fresh clone, so the README says to add them on an existing one). Rollback: revert the change and run `migrate:rollback`.

## Open Questions

None blocking.
