# E3 Chat

Real-time chat application built for the EMERGENT3 Senior Software Engineer technical exercise
(authentication, user roles, profiles, shared chat room, alerts with a 2×2 location map).

> **Status:** base project only (scaffold, containers, database connection, frontend skeleton).
> Features are added one at a time.

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

The first start installs Composer and npm dependencies and generates `APP_KEY`, so give it a minute.
Seed command and demo credentials will be added with the authentication feature.

| Service        | URL |
|----------------|-----|
| App (React)    | http://localhost:5173 |
| API (Laravel)  | http://localhost:8000/api/health |
| Mailpit inbox  | http://localhost:8025 |
| PostgreSQL     | `localhost:5433` (user/db `e3chat`, password in `docker-compose.yml`) |

Ports can be changed through a root `.env` (see `.env.example`). PostgreSQL uses 5433 on the host to
avoid clashing with a local server on 5432. If your host user is not UID/GID 1000, set `UID`/`GID` there.

The home page shows "Frontend, API and database are connected" when everything works.

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
