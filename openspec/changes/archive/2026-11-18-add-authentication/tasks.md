# Tasks

## 1. Backend setup

- [x] 1.1 Install `laravel/sanctum`, enable `statefulApi()`, set `SANCTUM_STATEFUL_DOMAINS` and a `frontend_url` config key in `.env.example`/`.env`/config; verify with `php artisan route:list` and that `/sanctum/csrf-cookie` responds 204.
- [x] 1.2 Make `TestCase` send a stateful `Referer`/`Origin` header; verify an existing test still passes with `php artisan test`.

## 2. Authentication API

- [x] 2.1 Add `LoginRequest` (validation + rate limiting), `UserResource`, and `AuthController` with `login`, `logout`, and `GET /api/user` under `auth:sanctum`; verify with feature tests for success, wrong password, unknown email, missing fields, throttling, logout and 401 when unauthenticated.
- [x] 2.2 Add the demo user to `DatabaseSeeder` (idempotent); verify `php artisan db:seed` twice creates one user.

## 3. Password recovery API

- [x] 3.1 Add `PasswordResetController` (`forgot-password`, `reset-password`) and `ResetPassword::createUrlUsing` pointing to the frontend; verify with tests using `Notification::fake()`: link sent for known email, nothing for unknown with identical response, invalid format, throttle, URL shape, valid reset, reused/invalid token, weak password, mismatched confirmation.
- [x] 3.2 Run `vendor/bin/pint` and the full backend suite; verify green.
- [x] 3.3 Verify end to end against Mailpit: request a reset with curl and confirm the email shows up in `http://localhost:8025` with the frontend link.

## 4. Frontend

- [x] 4.1 Install `react-router`; rework `api/client.ts` (CSRF, JSON helper, 204, `ApiError.errors`, unauthorized callback); verify with Vitest unit tests (add Vitest + Testing Library) covering CSRF header, 204 and 422 parsing.
- [x] 4.2 Add `AuthProvider`, `useAuth`, `RequireAuth`, `GuestOnly`, and the router in `App.tsx`; verify with component tests for redirects (guest to login, user away from login).
- [x] 4.3 Add `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` and a `HomePage` with a sign-out button, showing field and server errors; verify with component tests and a manual browser run of the full flow (login, logout, forgot, reset via Mailpit link).
- [x] 4.4 Verify `npm run build` and `npm run lint` pass.

## 5. Docs

- [x] 5.1 Update README (demo credentials, auth flow, Mailpit, how to run tests); verify commands run as written.

## Workflow follow-up

- Commit item 1 locally, then run `/opsx:archive` for this change.
