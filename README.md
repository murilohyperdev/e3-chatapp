# E3 Chat

Real-time chat application built for the EMERGENT3 Senior Software Engineer technical exercise
(authentication, user roles, profiles, shared chat room, alerts with a 2×2 location map).

> **Status:** authentication, user types, profiles and the real-time chat room are done. Features are added one at a time.

## Technology choices

| Layer     | Choice                                   | Why |
|-----------|------------------------------------------|-----|
| Backend   | PHP 8.4, Laravel 13 (JSON API)           | Required by the exercise. |
| Frontend  | React 19 + TypeScript + Material UI, Vite | Typed UI, ready-made accessible components, fast dev server. |
| Database  | PostgreSQL 17                            | Robust constraints (e.g. one location per user per alert) and a closer match to production than SQLite. |
| Real time | Laravel Reverb (WebSockets) + Laravel Echo | First-party, self-hosted, authorises private channels with the same session as the API. Alerts will reuse it. |
| Email     | Mailpit (local SMTP inbox)               | Password-reset emails are readable in a browser; the exercise accepts a local inbox. |
| Runtime   | Docker Compose                           | One command to start everything, same versions for everyone. |

## Requirements

- Docker with the Compose plugin (nothing else is needed on the host).

## Setup

```bash
docker compose up -d --build
docker compose exec backend php artisan migrate
```

```bash
docker compose exec backend php artisan db:seed
```

The first start installs Composer and npm dependencies and generates `APP_KEY`, so give it a minute.

**Demo accounts** (local development only, all with password `password`):

| Email | Type |
|-------|------|
| `admin@example.com` | Administrator |
| `user@example.com` | User |
| `grace@example.com`, `linus@example.com`, `margaret@example.com` | User |

| Service        | URL |
|----------------|-----|
| App (React)    | http://localhost:5173 |
| API (Laravel)  | http://localhost:8000/api/health |
| Mailpit inbox  | http://localhost:8025 |
| Reverb (WebSockets) | `ws://localhost:5173/app` (proxied by Vite to the `reverb` service on 8080) |
| PostgreSQL     | `localhost:5433` (user/db `e3chat`, password in `docker-compose.yml`) |

Ports can be changed through a root `.env` (see `.env.example`). PostgreSQL uses 5433 on the host to
avoid clashing with a local server on 5432. If your host user is not UID/GID 1000, set `UID`/`GID` there.

## User types and permissions

Each user has one `role`: `user` (default) or `administrator`. Permissions are Laravel Gates, one per ability, all
answered by `UserRole::abilities()` (a single table). The server enforces them: protect a route with
`->middleware(['auth:sanctum', 'can:start-alerts'])` and a user without the ability gets **403** (visitors get 401).
The role is not mass assignable, so it cannot be changed through request input. `GET /api/user` returns `role` and an
`abilities` map; the React UI uses it only to show or hide controls.

| Ability | User | Administrator |
|---------|:----:|:-------------:|
| `send-messages`, `receive-alerts`, `submit-locations`, `view-locations` | yes | yes |
| `start-alerts`, `end-alerts` | no | yes |

## Profiles and directory

| Endpoint | Purpose |
|----------|---------|
| `PATCH /api/users/{id}` | Edit name, phone, address. Owner only: anyone else (administrators included) gets 403 |
| `POST /api/users/{id}/avatar` | Multipart upload, field `avatar` (JPG/PNG/WebP, max 2 MB, 64-4096 px per side) |
| `DELETE /api/users/{id}/avatar` | Remove the picture |
| `GET /api/users?page=N` | Directory, 12 per page, ordered by name: only id, name, picture and user type |

Email and user type cannot be changed through these endpoints (extra fields are ignored). Pictures are stored on the
`public` disk (`storage/app/public/avatars`, served from `/storage` through the `storage:link` the container creates
on start); replacing or removing a picture deletes the old file. The directory never includes email, phone or address.

## Chat room

One shared room on the main page. Messages are stored in PostgreSQL and pushed to every other open session over a
WebSocket (Laravel Reverb), so nobody has to refresh. The page also shows whether live updates are connected and, after a
dropped connection comes back, fetches what it missed.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/messages?before={id}` | Latest 50 messages (oldest first), or the 50 before message `id`. Returns `meta.has_more` |
| `POST /api/messages` | Body `{"body": "text"}`, 1 to 2000 characters, trimmed. Needs the `send-messages` ability (403 otherwise), 30 per minute |
| `POST /api/broadcasting/auth` | Used by Echo to authorise the private `chat` channel with the session cookie (401 for visitors) |

Live event: private channel `chat`, event `message.created`, payload identical to a message in the HTTP responses:
`{id, body, created_at, user: {id, name, avatar_url}}`. The sender is always the signed-in user (a `user_id` in the request is
ignored) and senders never expose email, phone or address.

**Existing checkout?** `backend/.env` is only created on a fresh clone, so copy the new `BROADCAST_CONNECTION` and
`REVERB_*` lines from `backend/.env.example` into it. The containers only install dependencies when they are
missing, so also run:

```bash
docker compose up -d --build
docker compose exec backend composer install
docker compose exec frontend npm ci
docker compose exec backend php artisan migrate
```

The main page also carries a 1 px white text element required by the exercise brief.

## Alerts and locations

An administrator starts an alert; every open session gets a modal asking where the person is, with four labeled
squares (A to D) in a 2x2 grid. Each person picks one square (the first pick is final), and every session shows the
names inside the squares live. Several people can share a square. Chat keeps working. An administrator can end the
alert: further picks are refused. The state is stored in PostgreSQL, so a refresh or reconnect restores it (including an
alert that ended while the session was offline), and each new alert starts with no responses.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/alerts/current` | Latest alert (active or ended) with its responses, or `{"data": null}`. Needs `receive-alerts` and `view-locations` |
| `POST /api/alerts` | Start an alert. Needs `start-alerts`. 409 if one is already active |
| `POST /api/alerts/{alert}/responses` | Body `{"square": "a"}` (`a` to `d`). Needs `submit-locations`. 409 if the alert ended or you already picked, 422 for an invalid square |
| `POST /api/alerts/{alert}/end` | End the alert. Needs `end-alerts`. 409 if already ended |

Live event: private channel `alerts` (needs `receive-alerts` and `view-locations`), event `alert.changed`, payload is the whole
alert, identical to the HTTP responses: `{id, status: "active"|"ended", revision, started_at, ended_at, started_by,
responses: [{user: {id, name, avatar_url}, square}]}`. Clients keep the snapshot with the highest `revision`.

The database enforces the rules: a partial unique index allows one active alert, `UNIQUE (alert_id, user_id)` allows one
response per person per alert, and a CHECK limits the square to `a` to `d`.

**Existing checkout?** Run `docker compose exec backend php artisan migrate` to create the alert tables.

## Authentication

Session-based SPA authentication with Laravel Sanctum: the browser keeps an `HttpOnly` session cookie and sends a
CSRF token (`X-XSRF-TOKEN`) on state-changing requests. Vite proxies `/api` and `/sanctum`, so everything is same-origin.

| Endpoint                     | Purpose |
|------------------------------|---------|
| `GET /sanctum/csrf-cookie`   | Sets the CSRF cookie (the React client calls it automatically) |
| `POST /api/login`            | Email + password; 5 failed attempts per email+IP are throttled |
| `POST /api/logout`           | Ends the session (204) |
| `GET /api/user`              | Current user, 401 when signed out |
| `POST /api/forgot-password`  | Sends the reset email; same answer for unknown emails |
| `POST /api/reset-password`   | Token + email + new password (min 8, confirmed) |

**Password recovery:** request a link on `/forgot-password`, open the email in Mailpit
(http://localhost:8025) and follow the link to `/reset-password`. Links expire after 60 minutes and work once.

## Tests and checks

```bash
docker compose exec backend php artisan test      # backend (uses the separate e3chat_test database)
docker compose exec frontend npm run build        # type-check + production build
docker compose exec frontend npm run lint
```

## Project layout

```
backend/    Laravel API
frontend/   React + TypeScript + MUI (Vite)
docker/     Dockerfile and init scripts for the containers
docker-compose.yml   (backend, reverb, frontend, postgres, mailpit)
openspec/   Spec-driven change workflow
```

## Known limitations

- Development setup only: `php artisan serve` and the Vite dev server are not production servers.
