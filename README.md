# E3 Chat

Real-time chat application built for the EMERGENT3 Senior Software Engineer technical exercise
(authentication, user roles, profiles, shared chat room, alerts with a 2×2 location map).

> **Status:** authentication is done (login, logout, password recovery). Features are added one at a time.

## Technology choices

| Layer     | Choice                                   | Why |
|-----------|------------------------------------------|-----|
| Backend   | PHP 8.4, Laravel 13 (JSON API)           | Required by the exercise. |
| Frontend  | React 19 + TypeScript + Material UI, Vite | Typed UI, ready-made accessible components, fast dev server. |
| Database  | PostgreSQL 17                            | Robust constraints (e.g. one location per user per alert) and a closer match to production than SQLite. |
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

**Demo account** (local development only): `user@example.com` / `password`.

| Service        | URL |
|----------------|-----|
| App (React)    | http://localhost:5173 |
| API (Laravel)  | http://localhost:8000/api/health |
| Mailpit inbox  | http://localhost:8025 |
| PostgreSQL     | `localhost:5433` (user/db `e3chat`, password in `docker-compose.yml`) |

Ports can be changed through a root `.env` (see `.env.example`). PostgreSQL uses 5433 on the host to
avoid clashing with a local server on 5432. If your host user is not UID/GID 1000, set `UID`/`GID` there.

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
docker-compose.yml
openspec/   Spec-driven change workflow
```

## Known limitations

- Development setup only: `php artisan serve` and the Vite dev server are not production servers.
