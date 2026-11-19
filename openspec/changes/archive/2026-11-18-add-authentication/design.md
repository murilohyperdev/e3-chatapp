# Design

## Context

Laravel 13 API in `backend/`, React 19 + TypeScript + MUI in `frontend/`. The browser only talks to the Vite origin (`localhost:5173`), which proxies `/api` and `/sanctum` to Laravel, so the app is effectively same-origin. The `users` table, `password_reset_tokens` and `sessions` tables already exist from the Laravel skeleton. Mail goes through SMTP to Mailpit (`mailpit:1025`, UI on 8025). The existing `api()` fetch wrapper does not handle CSRF, 204 responses or validation errors. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A secure, simple login/logout/reset flow that later features (roles, profiles, chat, alerts) can build on.
- Thin controllers; validation in form requests; behaviour covered by feature tests.

**Non-Goals:**
- Registration, email verification, social login, remember-me, two-factor.
- Roles and authorization (next change).

## Decisions

1. **Sanctum SPA cookie authentication, not API tokens.** The SPA and API share an origin through the proxy, so the session cookie is `HttpOnly` and the token is never exposed to JavaScript (no XSS token theft, no token storage code). Alternatives: Sanctum personal access tokens or JWT (need client-side storage and manual revocation); plain Laravel web guard on `routes/web.php` (works, but Sanctum gives the standard SPA CSRF flow and `auth:sanctum` middleware that real-time channel auth can reuse later).
2. **Stateful domains.** `statefulApi()` in `bootstrap/app.php` plus `SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173` so requests from the Vite origin start a session. The Vite proxy runs with `changeOrigin`, which only rewrites `Host`; the `Origin`/`Referer` headers Sanctum checks stay intact.
3. **Login logic in a `LoginRequest` + thin `AuthController`.** The form request validates input, applies `RateLimiter` (key: lowercased email + IP, 5 attempts) and calls `Auth::attempt`; the controller regenerates the session and returns a `UserResource`. Failure message is identical for unknown email and wrong password to avoid account enumeration. Alternative: a dedicated action/service class; unnecessary for one use.
4. **Logout** logs out the web guard, invalidates the session and regenerates the CSRF token, returning 204.
5. **Password reset uses Laravel's broker.** `Password::sendResetLink` / `Password::reset` provide hashed, expiring (60 min), single-use, throttled (60 s) tokens. `ResetPassword::createUrlUsing` builds `{frontend_url}/reset-password?token=…&email=…` so the emailed link opens the React page. The frontend URL comes from a `config('app.frontend_url')` key (no `env()` outside config). The `forgot-password` endpoint always returns the same message for existing and unknown emails, but surfaces throttling.
6. **JSON everywhere.** Controllers return `UserResource`; `bootstrap/app.php` already renders JSON errors for `api/*`, so 401/422 are JSON.
7. **Frontend structure.** `react-router` for routing; an `AuthProvider` context holding `{user, status}` and `login/logout` functions, bootstrapped once from `GET /api/user`; a `RequireAuth` wrapper and a `GuestOnly` wrapper; pages `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `HomePage` (placeholder). Context is enough for one piece of global state; a data-fetching library is deferred until chat needs it.
8. **API client.** `api()` gets: CSRF handling (fetch `/sanctum/csrf-cookie` once and send the `X-XSRF-TOKEN` header read from the cookie on unsafe methods), JSON body helper, 204 support, and an `ApiError` carrying `status` and the 422 `errors` map. A 401 triggers an `onUnauthorized` callback so the provider can drop the user.
9. **Demo data.** `DatabaseSeeder` creates one demo user idempotently; README documents it. Role-specific accounts arrive with item 2.

## Risks / Trade-offs

- [Cookie auth needs the proxy/same-site setup in production] → Documented; the dev proxy mirrors a single-origin deployment.
- [Seeded demo password is public] → Seeder is for local/demo use only and says so in README.
- [CSRF handled by hand in fetch] → Isolated in the API client and covered by a frontend test.
- [Rate limit keyed on email + IP is per-process cache] → Fine for this scope; the cache store is shared across requests (database in dev).
