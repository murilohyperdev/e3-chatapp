# E3 Chat

Real-time chat application for the EMERGENT3 Senior Software Engineer technical exercise: authentication, user
types (administrator and user), profiles, one shared chat room, and administrator-started **alerts** where every
connected person picks a square on a 2x2 map and everyone sees the answers live.

Laravel 13 JSON API + React/TypeScript front end, WebSockets through Laravel Reverb, PostgreSQL, everything started
with one `docker compose up`.

**Status:** all 8 items of the exercise are implemented and tested. Where to look:

| Need | Go to |
|------|-------|
| Run it | [Quick start](#quick-start) |
| Log in | [Demo accounts](#demo-accounts) |
| Run the tests | [Tests](#tests) |
| Run or follow the live demo | [Demo](#demo) and [docs/DEMO.md](docs/DEMO.md) |
| Understand the code and the trade-offs | [Architecture](#architecture-and-key-decisions) and [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) ([pt-BR](docs/WALKTHROUGH.pt-BR.md)) |

## Technology choices and versions

| Layer     | Choice (version) | Why |
|-----------|------------------|-----|
| Backend   | PHP 8.4, Laravel 13 (JSON API), Sanctum | Required by the exercise. Cookie sessions for the SPA instead of tokens in JavaScript. |
| Frontend  | React 19, TypeScript 7, Material UI 9, Vite 8 (Node 22) | Typed UI, accessible ready-made components, fast dev server. |
| Database  | PostgreSQL 17 | Constraints the app relies on (one active alert, one location per user per alert) and closer to production than SQLite. |
| Real time | Laravel Reverb + Laravel Echo (laravel-echo 2) | First-party, self-hosted, authorises private channels with the same session as the API. |
| Email     | Mailpit | Local SMTP inbox with a web UI; password-reset emails are read there. |
| Tests     | PHPUnit, Vitest + Testing Library, Playwright 1.63 | Backend and UI unit/feature tests, plus optional real-browser journeys. |
| Runtime   | Docker Compose | Same versions for everyone, one command to start. |

Dependency lockfiles are committed: `backend/composer.lock`, `frontend/package-lock.json`, `e2e/package-lock.json`.
Example environment files: `.env.example` (compose ports) and `backend/.env.example` (Laravel, Reverb, mail).

## Quick start

Requirements: Docker with the Compose plugin. Nothing else is needed on the host (Node and a browser are only
needed for the optional end-to-end tests and the demo runner).

```bash
docker compose up -d --build
```

```bash
docker compose exec backend php artisan migrate
```

```bash
docker compose exec backend php artisan db:seed
```

The first start installs Composer and npm dependencies and generates `APP_KEY`, so give it a minute or two
(`docker compose ps` shows the services as healthy/running). Then open http://localhost:5173.
The seeder is idempotent, and restores the demo accounts to their documented state.

### Services and ports

| Service        | Where |
|----------------|-------|
| App (React, Vite dev server) | http://localhost:5173 |
| API (Laravel)  | http://localhost:8000/api/health |
| Mailpit inbox (reset emails) | http://localhost:8025 |
| Reverb (WebSockets) | `ws://localhost:5173/app`, proxied by Vite to the `reverb` service (port 8080 inside Docker) |
| PostgreSQL     | `localhost:5433` (user/db `e3chat`, password in `docker-compose.yml`) |

Ports can be changed through a root `.env` (copy `.env.example`). PostgreSQL uses 5433 on the host to avoid clashing
with a local server on 5432. If your host user is not UID/GID 1000, set `UID`/`GID` there as well.

### Demo accounts

Local development only. Every account uses the password `password`.

| Email | Type |
|-------|------|
| `admin@example.com` | Administrator (can start and end alerts) |
| `user@example.com` | User |
| `grace@example.com`, `linus@example.com`, `margaret@example.com` | User (`margaret@example.com` is the account the password-recovery demo and tests use) |

### Existing checkout

`backend/.env` is only created on a fresh clone. After pulling new work, copy any new lines from
`backend/.env.example` into it, then:

```bash
docker compose up -d --build
docker compose exec backend composer install
docker compose exec frontend npm ci
docker compose exec backend php artisan migrate
```

## Tests

With the stack running, one command runs the backend tests, frontend tests, lint, type-check and production build.
It keeps going after a failure and prints a PASS/FAIL summary:

```bash
./scripts/test.sh
```

Stages can also be run one by one:

```bash
docker compose exec backend php artisan test      # PHPUnit, separate e3chat_test database
docker compose exec frontend npm test             # Vitest + Testing Library
docker compose exec frontend npm run lint
docker compose exec frontend npm run build        # type-check + production build
```

`php artisan test` migrates the separate `e3chat_test` database by itself.
**Never run `migrate:fresh --env=testing`**: it would wipe the development database.

Covered, with success and failure paths: authentication and throttling, password recovery, roles and abilities (401/403
on direct requests), profiles and uploads, directory, chat (history, posting, rate limit, broadcast, channel
authorisation), alerts (start, pick, end, conflicts, database constraints, restore after reconnect), the demo seeder,
and the React pages, hooks and components. Details: [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md), section "Tests".

### End-to-end tests (browser, optional)

`e2e/` holds Playwright tests that drive real Chromium against the running stack with two independent sessions
(administrator and user): chat without refresh, alerts delivered live, permission checks (UI and direct API calls),
reload and offline/online recovery, and password recovery through Mailpit.

```bash
cd e2e && npm ci && npx playwright install chromium   # once
cd .. && ./scripts/test.sh --e2e                       # everything, including the browser tests
```

They are opt-in because they need a browser and run against the development stack: each run adds a few chat messages
(tagged `e2e-...`), starts and ends alerts, and changes then restores the password of `margaret@example.com`. They never
run migrations. If a run is killed during the password test, restore the demo password with
`docker compose exec backend php artisan db:seed`. To use an installed browser set `E2E_CHROMIUM_PATH`
(for example `/usr/bin/google-chrome`); `E2E_BASE_URL` and `E2E_MAILPIT_URL` override the default addresses.

## Demo

The exercise asks for two independent sessions logged in as different user types. [docs/DEMO.md](docs/DEMO.md) is the
manual script (about 8 minutes: chat, permission enforcement, alert delivery, location updates, refresh/reconnection,
ending alerts, password recovery) and the likely questions. The same seven scenarios run automatically in two browser
windows with on-screen captions:

```bash
./scripts/demo.sh                      # two windows side by side
./scripts/demo.sh --record             # also saves e2e/recordings/admin.webm and user.webm
./scripts/demo.sh --headless --record  # no windows (servers, rehearsal, fallback recording)
```

It needs the stack running and the e2e dependencies installed (see above), never runs migrations, ends the alerts it
starts and restores the password it changes. It finishes with "Demo finished".

## Architecture and key decisions

```
Browser (React, :5173)
   |  same-origin: /api, /sanctum, /storage, /app
   v
Vite dev server (proxy) ----> Laravel API (:8000) ----> PostgreSQL
   |                              |   |
   |                              |   +--> Mailpit (SMTP, inbox :8025)
   |  WebSocket /app              | publishes events
   v                              |
Reverb (:8080) <------------------+
```

- **One origin, cookie sessions.** The browser only talks to Vite, which proxies the API and the WebSocket path. Sanctum
  SPA mode keeps an `HttpOnly` session cookie plus a CSRF header, so there is no CORS and no token in JavaScript.
- **Permissions are server-side.** One `role` per user; each ability is a Laravel Gate answered by one table
  (`UserRole::abilities()`). Routes use `can:<ability>` middleware (401 for visitors, 403 without the ability); the UI
  only hides controls. The role is not mass assignable.
- **The database enforces the alert rules.** A partial unique index allows one active alert, `UNIQUE (alert_id, user_id)`
  allows one response per person per alert, and a CHECK limits the square to `a` to `d`. Races are decided by Postgres.
- **Live updates are snapshots with a revision.** Reverb pushes the whole alert (private channel `alerts`, event
  `alert.changed`) or the new message (private channel `chat`, event `message.created`). Clients keep the snapshot with
  the highest `revision`, so duplicated or late events are harmless.
- **Recovery without polling.** State lives in PostgreSQL. A client resynchronises on reconnect, on a 409, when the tab
  becomes visible and when the browser comes back online, so an alert that ended while offline still shows as ended.
- **Spec-driven.** Each item went through OpenSpec (explore, propose, apply, archive). Capability specs are in
  `openspec/specs/`, history in `openspec/changes/archive/`.

### API reference

| Endpoint | Purpose |
|----------|---------|
| `GET /sanctum/csrf-cookie` | Sets the CSRF cookie (the React client calls it automatically) |
| `POST /api/login`, `POST /api/logout`, `GET /api/user` | Session login (5 failed attempts per email+IP are throttled), logout (204), current user with `role` and `abilities` (401 when signed out) |
| `POST /api/forgot-password`, `POST /api/reset-password` | Reset email (same answer for unknown emails, 1 per minute) and token + new password (min 8, confirmed). Links expire after 60 minutes and work once |
| `PATCH /api/users/{id}` | Edit name, phone, address. Owner only (403 otherwise, administrators included) |
| `POST` / `DELETE /api/users/{id}/avatar` | Upload (field `avatar`, JPG/PNG/WebP, max 2 MB, 64-4096 px per side) or remove the picture. Owner only |
| `GET /api/users?page=N` | Directory, 12 per page: only id, name, picture and user type |
| `GET /api/messages?before={id}` | Latest 50 chat messages, or the 50 before message `id` (`meta.has_more`) |
| `POST /api/messages` | `{"body": "text"}`, 1 to 2000 characters. Needs `send-messages`, 30 per minute |
| `GET /api/alerts/current` | Latest alert with its responses, or `{"data": null}`. Needs `receive-alerts` and `view-locations` |
| `POST /api/alerts` | Start an alert (`start-alerts`). 409 if one is already active |
| `POST /api/alerts/{alert}/responses` | `{"square": "a"}` to `"d"` (`submit-locations`). 409 if ended or already answered, 422 for an invalid square |
| `POST /api/alerts/{alert}/end` | End the alert (`end-alerts`). 409 if already ended |
| `POST /api/broadcasting/auth` | Echo authorises private channels with the session cookie (401 for visitors) |

| Ability | User | Administrator |
|---------|:----:|:-------------:|
| `send-messages`, `receive-alerts`, `submit-locations`, `view-locations` | yes | yes |
| `start-alerts`, `end-alerts` | no | yes |

Email, phone and address are never exposed to other users (directory, chat senders and alert responses only carry id,
name and picture). The main page also carries a 1 px white text element required by the exercise brief. For file-by-file
explanations and the full trade-off list see [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md).

## Project layout

```
backend/    Laravel API (app, routes, migrations, seeders, PHPUnit tests)
frontend/   React + TypeScript + MUI (Vite, Vitest)
e2e/        Playwright journeys and the demo runner
docker/     Dockerfile and init scripts for the containers
docs/       DEMO.md (live script), WALKTHROUGH.md / WALKTHROUGH.pt-BR.md (code tour)
scripts/    test.sh (whole suite), demo.sh (guided two-session demo)
openspec/   Spec-driven change workflow: specs and archived changes
docker-compose.yml   backend, reverb, frontend, postgres, mailpit
```

## Known limitations

- Development setup only: `php artisan serve` and the Vite dev server are not production servers, and the demo
  credentials and seeder are for local use. Production would need a built front end behind one reverse proxy (or
  adjusted Sanctum domains) and a production Reverb setup.
- One chat room; messages are plain text and are never edited, deleted or moderated.
- A location pick is final (one response per user per alert); changing it would be a different rule.
- Reading alert state needs both `receive-alerts` and `view-locations`, because one broadcast shows who is where.
- An ended alert stays on the board as "ended" until a new alert starts.
- Reverb runs as a single process without Redis scaling; fine for this scope.
- No registration or email verification (accounts come from the seeder); no image resizing or CDN for avatars.
- Password-reset emails are limited to one per minute per address, and only land in the local Mailpit inbox.
- The Playwright tests and the demo run against the development database, so they leave some chat messages behind.
