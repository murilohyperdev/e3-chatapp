# Tasks

## 1. Infrastructure and broadcasting

- [x] 1.1 Install `laravel/reverb`, publish the broadcasting/reverb config, add keys to `.env.example`, `.env.testing`/phpunit (`BROADCAST_CONNECTION=null`), and the `reverb` Compose service plus `VITE_REVERB_*` for the frontend; verify the container starts and `docker compose logs reverb` shows it listening.
- [x] 1.2 Register broadcasting routes under `/api` with `auth:sanctum` in `bootstrap/app.php` and create `routes/channels.php` with the private `chat` channel; verify with feature tests: signed-in user authorised, visitor refused.

## 2. Messages API

- [x] 2.1 Add the `messages` migration, `Message` model (`user_id` not fillable, `user` relation) and factory; verify with `migrate` and a unit test of the fillable/relation.
- [x] 2.2 Add `MessageResource`, `StoreMessageRequest`, `MessageController@index` (keyset pagination, `has_more`) and `GET /api/messages`; verify with feature tests: latest 50 in order, `before` pagination, `has_more`, empty room, no private fields, visitor 401.
- [x] 2.3 Add `POST /api/messages` (`can:send-messages`, throttle) storing the message for the signed-in user; verify with feature tests: valid (201 + shape), trimmed, missing/blank/over 2000 chars 422, forged `user_id` ignored, user without ability 403, visitor 401, nothing stored on failure.

## 3. Real-time delivery

- [x] 3.1 Add the `NewMessage` event (`ShouldBroadcastNow`, private `chat`, `message.created`) and dispatch with `toOthers()` after saving, logging (not failing) if the broadcaster is down; verify with `Event::fake` tests: dispatched on the right channel with the resource payload, not dispatched on a failed post, post still 201 when broadcasting throws.

## 4. Frontend

- [x] 4.1 Add `laravel-echo` and `pusher-js`, `lib/echo.ts` (auth through `/api/broadcasting/auth` with a fresh XSRF header) and the Vite WebSocket proxy; verify `npm run build` and a unit test that the Echo options point at the proxy and the auth endpoint.
- [x] 4.2 Add `api/messages.ts` and the `useChat` hook (initial load, send, dedupe by id, load older, connection state, refetch on reconnect); verify with hook tests using a fake Echo: live message appended, own message not duplicated, reconnect merges missed messages, send error surfaced.
- [x] 4.3 Add `ChatPanel` and show it on `HomePage` with the required 1px white text; verify with component tests: list with sender and time, own-message styling, Enter sends / Shift+Enter newline, error keeps text, composer disabled without ability, load older, offline notice, exact hidden text present, then `npm test`, `npm run build`, `npm run lint`.

## 5. Docs and end-to-end check

- [x] 5.1 Update the README (Reverb service, env keys, endpoints, event contract); verify with `php artisan test`, pint, and a manual run with two browsers (two users): message appears in the other one live, survives reload, visitor cannot subscribe.
- [x] 5.2 Update `docs/WALKTHROUGH.md` and `docs/WALKTHROUGH.pt-BR.md` with this feature's code and the reasons for each decision.

## Workflow follow-up

- Commit locally on `feature/chat-room`, ask for confirmation before pushing and merging, then run `/opsx:archive` for this change.
