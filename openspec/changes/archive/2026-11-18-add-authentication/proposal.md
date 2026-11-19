# Proposal

## Why

The chat app has no notion of who is using it. Every later feature (roles, profiles, chat, alerts) needs a trusted, server-side identity, and users who forget their password need a way back in. Authentication is the first item of the EMERGENT3 exercise and everything else depends on it.

## What Changes

- Add session-based SPA authentication to the Laravel API (Laravel Sanctum, cookie + CSRF): log in, log out, and fetch the current user.
- Throttle failed login attempts per email and IP.
- Add password recovery: request a reset link by email (delivered to Mailpit in development) and set a new password with the link's token.
- Make the reset link point to a React page, not to a Laravel web route.
- Add the React side: router, auth context, protected routes, and login, forgot-password and reset-password pages.
- Harden the frontend HTTP client: CSRF handling, empty (204) responses, and keeping 422 validation errors for forms.
- Seed one demo account so the flow can be tried (role-specific accounts come with the next item).

## Capabilities

### New Capabilities
- `user-auth`: signing in and out with email and password, the authenticated session, and access control for unauthenticated requests.
- `password-recovery`: requesting a reset link by email and choosing a new password with it.

### Modified Capabilities

None (the project has no existing specs).

## Impact

- Backend: new `laravel/sanctum` dependency, auth controllers and form requests, a reset-password notification URL, `bootstrap/app.php` (stateful API), `.env`/`.env.example` (stateful domains), routes in `routes/api.php`, feature and unit tests.
- Frontend: new `react-router` dependency, API client changes, auth provider, protected routes, three pages.
- README: demo credentials and a note on where reset emails arrive.
- Out of scope: roles and permissions (item 2), profiles (item 3), email verification, social login, "remember me".
