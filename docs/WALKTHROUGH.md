# Codebase walkthrough (items 1 to 5)

Interview notes: what each part does and why it was built that way. Portuguese version: [WALKTHROUGH.pt-BR.md](WALKTHROUGH.pt-BR.md).

## 1. How the pieces fit

```
Browser (React, :5173)
   |  same-origin requests: /api, /sanctum, /storage, /app
   v
Vite dev server (proxy)  ---->  Laravel API (:8000)  ---->  PostgreSQL
   |                                  |    |
   |                                  |    +--> Mailpit (SMTP :1025, inbox UI :8025)
   |  WebSocket upgrade: /app         |
   v                                  | publishes new messages (HTTP)
Reverb WebSocket server (:8080)  <----+
```

* **One origin.** The browser only talks to Vite, which proxies `/api`, `/sanctum` and `/storage` to Laravel and the WebSocket path `/app` to Reverb. Cookies are
  first-party, there is no CORS, and the same shape works behind a single reverse proxy in production.
* **Sessions, not tokens.** Laravel Sanctum's SPA mode keeps the login in an `HttpOnly` session cookie that JavaScript
  cannot read, so an XSS bug cannot steal a token. Revocation is just ending the session.
* **Spec-driven workflow.** Every item went through OpenSpec: explore, propose (proposal, specs, design, tasks),
  apply, archive. The resulting capability specs live in `openspec/specs/` (`user-auth`, `password-recovery`,
  `user-roles`, `user-profiles`, `user-directory`, `chat-messages`, `chat-realtime`, `chat-page`, `alert-lifecycle`, `alert-locations`, `alert-realtime`, `alert-page`) and the history in `openspec/changes/archive/`.

## 2. Item 1: authentication

**Backend**

| File | What and why |
|------|--------------|
| `bootstrap/app.php` | `statefulApi()` starts a session and checks CSRF for requests from the SPA origin. |
| `.env` `SANCTUM_STATEFUL_DOMAINS` | Without `localhost:5173` in this list Sanctum would treat the SPA as a stateless client and no session would start. |
| `Http/Requests/Auth/LoginRequest.php` | Validation plus rate limiting (5 failures per email+IP, then a wait). Same error for unknown email and wrong password so accounts cannot be enumerated. |
| `Http/Controllers/Auth/AuthController.php` | Thin: `login` (regenerates the session id against session fixation), `logout` (invalidates the session, rotates the CSRF token, returns 204), `me`. |
| `Http/Controllers/Auth/PasswordResetController.php` | Uses Laravel's password broker: hashed, single-use, 60-minute tokens and a 60-second request throttle. `forgot` answers identically for known and unknown emails. |
| `Providers/AppServiceProvider.php` | `ResetPassword::createUrlUsing` makes the emailed link point at the React page (`/reset-password?token=..&email=..`) instead of a Laravel route that does not exist. |
| `config/app.php` `frontend_url` | Config key read from `FRONTEND_URL`; code never calls `env()` outside config. |
| `Http/Resources/UserResource.php` | Whitelist of fields returned: the password can never leak by accident. |

**Frontend**

| File | What and why |
|------|--------------|
| `api/client.ts` | `fetch` wrapper. Fetches `/sanctum/csrf-cookie` when needed and echoes the `XSRF-TOKEN` cookie in `X-XSRF-TOKEN` (axios does this for free, fetch does not). Handles 204, keeps the 422 `errors` map on `ApiError`, retries once on 419, and notifies the auth provider on any 401. |
| `auth/AuthProvider.tsx` | The only holder of "who is signed in". Asks the server (`GET /api/user`) on load; nothing is stored in the browser. A context is enough for one piece of global state. |
| `auth/guards.tsx` | `RequireAuth` and `GuestOnly` route wrappers: redirects stay out of the pages themselves. |
| `pages/Login`, `ForgotPassword`, `ResetPassword` | Forms showing field errors from the server. The reset page is outside `GuestOnly` so the emailed link works in any state. |

**Why these decisions.** Cookie sessions over JWT: no token storage, free revocation, CSRF is the price and it is
handled in one place. The broker for resets: expiry, hashing and throttling are solved problems; hand-rolled tokens
are a classic source of vulnerabilities.

## 3. Item 2: user types and permissions

* `users.role` is a string column defaulting to `user`, cast to the `UserRole` enum (`user`, `administrator`).
  An enum cast keeps validity in PHP and the migration trivial (a database enum type is painful to change).
* `Enums/Ability.php` lists the six abilities named in the brief. `UserRole::abilities()` is the **single table** of
  who can do what; gates, the API response, the README table and the tests all read from it.
* `AppServiceProvider` registers one **Gate** per ability. Gates (not policies) because these are application-wide
  capabilities with no model yet. A future route is protected with
  `->middleware(['auth:sanctum', 'can:start-alerts'])`: visitors get 401, users without the ability get 403.
* `role` is **not** in `#[Fillable]` and is not in any validation rule, so no request can promote a user. A test pins
  this. The seeder and factory set it explicitly (`forceFill`, `administrator()` state).
* `GET /api/user` returns `role` and an `abilities` map. The React UI only uses it to hide controls; the server
  decides every request.
* Alerts and chat do not exist yet, so `RoleEnforcementTest` registers throwaway routes with the real middleware to
  prove 401/403/200 and direct requests with a real session.
* Seeds (`DatabaseSeeder`): `admin@example.com` (administrator), `user@example.com`, three more users; idempotent;
  password `password` (demo only).

## 4. Item 3: profiles and directory

* Columns `phone`, `address`, `avatar_path` on `users` (one-to-one, small, so no separate table).
  Only `name`, `phone`, `address` are fillable; `email`, `role` and `avatar_path` are not.
* **Ownership** is `UserPolicy::update` (`$actor->is($target)`). A policy is right here because the rule depends on a
  model instance. Administrators are deliberately not exempt, as the brief says no one edits another profile.
* The form requests authorize with the policy, so authorization runs **before** validation: editing someone else is
  always 403, never a 422 that says something about the target.
* **Validation:** name required, 100 max; phone `+`, digits, spaces, dashes, parentheses, 7 to 20 chars; address 255
  max; picture `image`, `mimes:jpg,jpeg,png,webp` (checks real content, SVG excluded because it can carry scripts),
  2 MB, 64 to 4096 px.
* **Storage:** public disk, hashed file names, the database keeps a relative path; the new path is saved before the old
  file is deleted so a failure never leaves a profile pointing at nothing. The `public` disk URL is relative
  (`/storage/...`) so it works through the Vite proxy; the container entrypoint creates the `storage:link`.
* **Two resources:** `UserResource` (self: email, phone, address) and `DirectoryUserResource` (id, name, picture,
  role). Separate classes make a leak a visible contract instead of one missed `when()`; the directory query also
  selects only those columns. `GET /api/users` is paginated (12 per page) and ordered by name.
* **Frontend:** `AppLayout` (navigation), `ProfilePage` (form, picture upload/remove, saves refresh the signed-in
  user), `PeoplePage` (directory with "Load more", initial fallback avatar). Uploads use `FormData` without a
  manual `Content-Type` so the browser sets the multipart boundary. Avatar upload is a POST because PHP does not
  parse multipart bodies on PATCH.

## 5. Item 4: the chat room

**Flow of one message.** The browser `POST`s `/api/messages` (session cookie + CSRF) -> `can:send-messages` gate ->
`StoreMessageRequest` validates -> the message is saved with the signed-in user as sender -> `NewMessage` is broadcast on
the private channel `chat` to Reverb -> Reverb pushes it over the open WebSockets of every other tab -> `useChat` merges it
into the list. The sender gets the same JSON in the HTTP response, so it is shown immediately and exactly once.

**Why Reverb + Echo (decided in explore).** Polling is simple but laggy and wasteful, so it is not really real time.
Server-Sent Events would hold a connection open per user and `php artisan serve` handles one request at a time, so the API
would stall (and Laravel has no first-party SSE channel authorisation). Pusher or Ably need an external account. A Node
socket.io sidecar adds a second language and a second auth system. Reverb is first-party, self-hosted, speaks the Pusher
protocol (so `pusher-js` and Echo work unchanged) and authorises private channels with the session we already have. Item 5
(alerts) publishes on the same connection, and chat keeps working during an alert because they are separate channels.

**Backend**

| File | What and why |
|------|--------------|
| `database/migrations/..._create_messages_table.php` | `user_id` (foreign key, cascade, indexed) + `body` text + timestamps. History is paged by `id`, so no extra index. |
| `Models/Message.php` | Only `body` is `#[Fillable]`; the sender is set through `$user->messages()->create(...)`, so a request can never forge `user_id` (a test pins it). |
| `Http/Requests/StoreMessageRequest.php` | `required|string|max:2000`. Laravel's `TrimStrings` middleware trims and turns a blank text into `null`, so whitespace-only fails `required`. |
| `Http/Controllers/MessageController.php` | `index`: keyset pagination (`id < before`, newest first, `limit 51` to learn `has_more` without a count query, then reversed to chronological). Offset pages would shift and duplicate rows while new messages keep arriving. `store`: saves, then broadcasts with `toOthers()` inside a try/catch, so a Reverb outage never loses a saved message. |
| `Http/Resources/MessageResource.php` | One shape for the HTTP responses **and** the broadcast. The sender exposes only id, name and picture. |
| `Events/NewMessage.php` | `ShouldBroadcastNow` on `PrivateChannel('chat')`, name `message.created`. "Now" instead of queued: no queue worker process to run, one HTTP call to Reverb. Trade-off: the POST waits for that call (acceptable here, and failures are swallowed and reported). |
| `routes/channels.php` | `Broadcast::channel('chat', ...)`: any signed-in user may listen. Writing is protected by the gate on the route. |
| `bootstrap/app.php` | `withBroadcasting(..., ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']])` exposes `POST /api/broadcasting/auth` under `/api`, so it goes through the existing proxy and uses the session cookie. |
| `routes/api.php` | `GET /messages`, and `POST /messages` with `can:send-messages` + `throttle:30,1` (anti-flood). |
| `docker-compose.yml` | New `reverb` service: same image, runs `php artisan reverb:start`. The API gets a healthcheck and `reverb` waits for it, so two containers never run `composer install` together on a fresh clone. |

**Frontend**

| File | What and why |
|------|--------------|
| `lib/echo.ts` | The only file that knows about WebSockets. Connects to the **page's own origin** (Vite forwards `/app` to Reverb: no CORS, no extra port). Channel authorisation uses a `headersProvider` that reads the `XSRF-TOKEN` cookie at each attempt, so a rotated token is never stale. Exposes `subscribeToChat({onMessage, onStatus})`. `disconnectEcho()` runs on sign-out. |
| `api/client.ts` | Sends `X-Socket-ID` (Echo adds it by itself only for axios, not `fetch`), which lets the server's `toOthers()` skip the sender's own tab. |
| `chat/useChat.ts` | State owner: history, live messages, send, load older, connection status. Messages are **merged by id** and sorted, so a message that arrives live and from history (or twice) shows once; this makes `toOthers()` an optimisation, not a correctness need. After a reconnect it refetches the latest page, which covers everything missed while offline. |
| `components/ChatPanel.tsx` | Presentational: list (own messages right-aligned and coloured), offline notice, composer. Enter sends, Shift+Enter is a new line, Enter during IME composition does not send. Stays at the bottom for new messages, keeps position when older ones are inserted above. A failed send shows the server message and **keeps the text**. Text is rendered by React as text, so stored HTML is never executed. |
| `pages/HomePage.tsx` | Shows the chat (composer disabled without `send-messages`) and the brief's 1 px white text element, as real page text (not `display: none`). |

## 6. Item 5: alerts and locations

**Flow.** An administrator presses *Start alert*: `POST /api/alerts` -> `can:start-alerts` gate -> a row is inserted in
`alerts` -> `AlertChanged` is broadcast on the private channel `alerts` -> every open session receives the full alert
and `AlertModal` opens by itself. Each person clicks a square: `POST /api/alerts/{alert}/responses` -> `can:submit-locations`
-> the alert row is locked, checked "still active", the response is stored, `revision` goes up -> `AlertChanged` again ->
every session redraws the board with the name inside the square. *End alert* (`POST /api/alerts/{alert}/end`, gate
`can:end-alerts`) does the same dance and closes the picks. Chat is a different channel and is not touched.

**The central idea: snapshots, not deltas.** Every event and every HTTP response is the *whole* alert (status,
revision, who is in which square). The client only has to answer "which snapshot is newest?" (`applySnapshot`: higher
alert id wins, then higher `revision`). So a duplicate, late or reordered message is harmless, and recovering from a lost
connection is just `GET /api/alerts/current`. Deltas ("Bob picked B") would need ordering and gap detection, and reconnect
would need a refetch anyway.

**Rules live in the database.** PHP checks are not enough when two requests race, so:

| Rule | Where it is enforced |
|------|----------------------|
| One active alert | Partial unique index `CREATE UNIQUE INDEX alerts_single_active ON alerts ((true)) WHERE ended_at IS NULL`: every active row has the same constant key, so a second one is refused. A race gives one 201 and one 409. |
| One response per user per alert | `UNIQUE (alert_id, user_id)`. The controller turns the violation into 409 ("first pick is final"). |
| Only squares a to d | `CHECK (square IN ('a','b','c','d'))` plus the `Square` enum for validation. |
| No pick after the end | `SELECT ... FOR UPDATE` on the alert row inside a transaction in both "pick" and "end": a pick either commits before the end or waits, sees `ended_at` set and gets 409. |
| New alert starts empty | Responses belong to an `alert_id`; a new alert is a new row with no responses. |

"Active" is just `ended_at IS NULL`; a separate `status` column could disagree with the timestamp, so there is none.

**Permissions (server side, direct requests too).** Each route names its ability through `can:` middleware, so someone
without it gets 403 before any controller code runs: start `start-alerts`, end `end-alerts`, pick `submit-locations`, and
read (`GET /alerts/current` and the channel) `receive-alerts` **and** `view-locations`, because the payload says who is
where and a broadcast cannot be filtered per user. Tests call the endpoints directly as a regular user and as a visitor.

**Backend**

| File | What and why |
|------|--------------|
| `database/migrations/..._create_alerts_table.php` | `alerts` (`started_by`, `ended_by` with `nullOnDelete` so history outlives a deleted admin, `ended_at`, `revision`) and `alert_responses` (cascade FKs, unique pair, CHECK). |
| `Enums/Square.php` | The four keys. Labels ("Square A") belong to the UI. |
| `Models/Alert.php`, `Models/AlertResponse.php` | `Alert` has nothing mass assignable (the server sets who/when). `AlertResponse` only allows `square`; person and alert come from the session and the route, so the body cannot forge them. |
| `Http/Controllers/AlertController.php` | `current` (latest alert, active or ended, or `data: null`), `store` (catches the unique violation -> 409), `end` (locked, 409 if already ended). |
| `Http/Controllers/AlertResponseController.php` | Locks the alert, rejects ended alerts (409), stores the pick, bumps `revision`, maps the unique violation to 409. |
| `Http/Requests/StoreAlertResponseRequest.php` | `square` required and one of the enum values. |
| `Http/Resources/AlertResource.php` | The one snapshot shape for HTTP and broadcast. People expose only id, name and picture. |
| `Events/AlertChanged.php` | `ShouldBroadcastNow` on `private-alerts`, name `alert.changed`. `announce()` wraps the broadcast in try/catch: the change is already saved, so a Reverb outage is logged, not turned into a failed request. No `toOthers()`: snapshots are idempotent, so the sender can be driven by the same event as everyone else. |
| `routes/channels.php` | `alerts` channel: needs `receive-alerts` and `view-locations`. |

**Frontend**

| File | What and why |
|------|--------------|
| `api/alerts.ts` | Types, the four squares with labels, and the four calls. |
| `alerts/applySnapshot.ts` | The pure "newest wins" rule (unit tested on its own). |
| `alerts/useAlert.ts` | State owner: loads `/current`, subscribes, applies snapshots, refetches after a reconnect (this is how an alert that ended while offline shows up), exposes `start`, `end`, `pick`. A first load that returns `null` never erases an alert a live event already delivered. |
| `lib/echo.ts` | New `subscribeToAlerts`; the connection-status code was extracted so chat and alerts share it. |
| `components/AlertModal.tsx` | MUI `Dialog` with no `onClose`, so Escape and clicking outside do nothing: the person must pick. It opens only for an *active* alert when the user may submit and has not picked, so a reload before picking opens it again, and after picking it stays closed. A server error is shown and the modal stays open. |
| `components/AlertBoard.tsx` | The 2x2 grid with each square's label and the names inside it (several per square), and an "active / ended" notice. |
| `components/AlertSection.tsx` | Composes hook + board + modal + the administrator's Start/End buttons (shown only with `start-alerts` / `end-alerts`). The hook lives here, not in the modal, so the subscription stays open while the modal is closed. |
| `pages/HomePage.tsx` | Renders `AlertSection` above the chat, so chat stays usable during an alert. |

**Manual test with two sessions** (stack running, demo data seeded):

1. Open <http://localhost:5173> in a normal window and sign in as `admin@example.com` / `password`. Open a private
   window (separate cookies) and sign in as `user@example.com` / `password`.
2. In the administrator window press **Start alert**. Both windows open the modal with Square A to D by themselves.
3. In the user window click **Square B**: the modal closes and "Demo User (you)" appears in Square B. In the administrator
   window the name "Demo User" appears in Square B without reloading.
4. In the administrator window click **Square B** too: both names are in Square B in both windows (squares can be shared).
5. Send a chat message from each window while the alert is active: chat still works.
6. Refresh the user window: no modal (already picked) and the board still shows both names.
7. While the alert is active there is no Start button. A direct `POST /api/alerts` as the administrator answers 409, and as
   the user it answers 403.
8. Press **End alert**: both windows show "This alert has ended" and further picks are refused (`POST .../responses`
   answers 409).
9. Reconnection: press **Start alert** for a new alert, then stop Reverb (`docker compose stop reverb`) and end the alert in
   the administrator window (this works, it is plain HTTP). The user window still shows it as active. Start Reverb again
   (`docker compose start reverb`): after it reconnects the user window shows the ended alert by itself.
10. Press **Start alert** again: the board is empty and everyone can pick again.

## 7. Tests


* **Backend (141 tests, 469 assertions, PHPUnit against a separate `e3chat_test` database):** login success/failure/
  throttling, logout and 401, password reset (link target, unknown email, throttle, expired, reused or invalid token,
  weak password), gates for both roles, 401/403/200 enforcement, mass-assignment, profile validation per field,
  other-user and administrator 403, uploads (valid, replaced, removed, wrong type, wrong format, too large, too
  small, too many pixels, missing), directory ordering, pagination and absence of private fields; chat: post (valid, trimmed, exactly 2000, 2001, empty/blank/missing/array, forged sender, 403 without the ability, 401), history (empty, order, 50 per page, `before`, `has_more`, invalid cursor, no private fields, no N+1, 401), broadcast (right channel/name/payload, same shape as the HTTP response, nothing on failure, broadcaster down still 201 and saved) and channel authorisation (member signed, visitor 401, other channels 403); alerts: start (administrator 201 and empty, regular user 403 and nothing created, visitor 401, second active alert 409, a new alert after the end starts empty), current (none, active with responses, ended while offline, latest only, no private fields, 401), pick (valid, administrator too, shared square, second pick 409 and first kept, again in a new alert, invalid/missing/wrong-case/array square 422, ended alert 409, unknown alert 404, forged person ignored, 403 without the ability, 401), end (responses kept, twice 409, 403 for a user, 401, 404, pick after the end refused), the database constraints hit with raw inserts (second active alert, duplicate response, square outside a to d, cascades, mass assignment), broadcast (channel/name/snapshot, revision, nothing on any rejected request, broadcaster down still succeeds) and the `alerts` channel (permitted user, missing ability 403, visitor 401). Two requests truly racing are covered by the database constraints rather than by a concurrent test.
* **Frontend (89 tests, Vitest + Testing Library):** API client (CSRF, 204, 422, 419 retry, 401 handler, multipart, socket id header),
  route guards, login/forgot/reset pages, profile page, people page, home page (including the exact 1 px white text), Echo options
  (own origin, fresh CSRF header), and the chat panel with a fake real-time layer (history, live message, no duplicates, send
  by button/Enter/Shift+Enter, blank, server error keeps text, no ability, older messages, offline notice, catch-up after
  reconnect, retry, HTML shown as text, unsubscribe on unmount); alerts: `applySnapshot` (newer id, higher revision, stale ignored, idempotent), `useAlert` with a fake Echo (live start, stale ignored, an empty first load does not erase a live alert, catch-up of an alert that ended while offline, actions, errors, retry), `AlertModal` (four labeled squares, pick, cannot be dismissed, server error keeps it open, closed after picking / ended / without ability), `AlertBoard` (names in squares, shared squares, ended notice) and `AlertSection` (modal opens live, name appears after picking, reload restores, ending closes the modal, controls per role, nothing for users who may not receive alerts).
* Run them: `docker compose exec backend php artisan test` and `docker compose exec frontend npm test`.

## 8. Trade-offs to mention

* Same-origin proxy and cookie sessions need a single-origin deployment in production (or Sanctum domain config).
* Demo credentials are public by design; the seeder is for local use.
* No image resizing or CDN: out of scope for the exercise, easy to add behind the avatar endpoint.
* No email verification or registration: not in items 1 to 4.
* The per-ability gates are application-wide on purpose; per-resource rules (profiles) use a policy.
* WebSocket server is one process (no Redis scaling) and chat is one room: right for the scope, and Reverb can scale
  with Redis if ever needed.
* Messages are plain text, never edited or deleted, and not moderated: out of scope.
* The hidden 1 px white text is required by the brief; it is invisible and carries no interaction.
* Alerts: the first pick is final (the brief says one response per user per alert); changing a pick would be an upsert, but that is a different rule.
* Reading alert state needs both `receive-alerts` and `view-locations` because one broadcast payload goes to everyone and it names who is where.
* The `alerts_single_active` index is a Postgres-specific partial expression index; the project is Postgres-only, and the database is the one place that cannot be raced.
* An ended alert stays on the board as "ended" until a new alert starts; hiding old alerts is a UI refinement, not a data problem.
