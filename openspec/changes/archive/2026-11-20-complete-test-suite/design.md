# Design

## Context

The suite runs on PHPUnit-style Pest-less Laravel tests (`php artisan test`, PostgreSQL database `e3chat_test`, set in `phpunit.xml`) and Vitest + Testing Library on the frontend. See proposal.md for motivation. An audit of existing tests against controllers, requests, enums, seeder, channels and frontend modules found the gaps listed there. Constraint from the project: tests must never run `migrate:fresh --env=testing`, which would wipe the development database.

## Goals / Non-Goals

**Goals:**
- Close only real gaps; do not duplicate what the 242 existing tests already prove.
- One documented command to run everything.

**Non-Goals:**
- No browser end-to-end tests (the live demo covers that).
- No coverage-percentage gate: no coverage driver is installed, and a number would not show which behaviours are proven.
- No CI workflow in this change.

## Decisions

- **Gap audit by behaviour, not by line coverage.** Each controller/request/route rule was matched to a named test. Alternative: install pcov and chase percentages; rejected as heavier and misleading.
- **Seeder test uses `RefreshDatabase` and `$this->seed()`.** Running it twice proves idempotency; signing in through the real login endpoint proves the documented password works.
- **Throttle test hits the real `throttle:30,1` middleware** with 31 posts (cheap with BCRYPT_ROUNDS=4 and the array cache) instead of mocking the limiter, so it proves the route wiring.
- **Missing-ability 403 on `/alerts/current`** uses the same `Gate::define` override technique already used by the submit-location test, since both built-in roles hold these abilities.
- **Frontend tests mock `api/*` modules, not `fetch`,** matching existing page tests; `AuthProvider` is tested through a small consumer component.
- **`scripts/test.sh` is plain bash** running `docker compose exec -T` per stage, collecting exit codes (no `set -e`) so every stage runs and the summary shows all failures. It calls `php artisan test` only, never migrate commands. Alternative: a Makefile or npm script; rejected to avoid a new tool and because the stages span two containers.

## Risks / Trade-offs

- [Throttle test leaks limiter state to other tests] → array cache driver is per-process and reset per test case; assert in a single test.
- [Script requires the compose stack] → it checks the services are up and prints the `docker compose up -d` hint.
