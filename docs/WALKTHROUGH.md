# Codebase walkthrough (items 1 to 3)

Interview notes: what each part does and why it was built that way.

## 1. How the pieces fit

```
Browser (React, :5173)
   |  same-origin requests: /api, /sanctum, /storage
   v
Vite dev server (proxy)  ---->  Laravel API (:8000)  ---->  PostgreSQL
                                      |
                                      +--> Mailpit (SMTP :1025, inbox UI :8025)
```

* **One origin.** The browser only talks to Vite, which proxies `/api`, `/sanctum` and `/storage` to Laravel. Cookies are
  first-party, there is no CORS, and the same shape works behind a single reverse proxy in production.
* **Sessions, not tokens.** Laravel Sanctum's SPA mode keeps the login in an `HttpOnly` session cookie that JavaScript
  cannot read, so an XSS bug cannot steal a token. Revocation is just ending the session.
* **Spec-driven workflow.** Every item went through OpenSpec: explore, propose (proposal, specs, design, tasks),
  apply, archive. The resulting capability specs live in `openspec/specs/` (`user-auth`, `password-recovery`,
  `user-roles`, `user-profiles`, `user-directory`) and the history in `openspec/changes/archive/`.

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

## 5. Tests

* **Backend (70 tests, 245 assertions, PHPUnit against a separate `e3chat_test` database):** login success/failure/
  throttling, logout and 401, password reset (link target, unknown email, throttle, expired, reused or invalid token,
  weak password), gates for both roles, 401/403/200 enforcement, mass-assignment, profile validation per field,
  other-user and administrator 403, uploads (valid, replaced, removed, wrong type, wrong format, too large, too
  small, too many pixels, missing), directory ordering, pagination and absence of private fields.
* **Frontend (29 tests, Vitest + Testing Library):** API client (CSRF, 204, 422, 419 retry, 401 handler, multipart),
  route guards, login/forgot/reset pages, profile page, people page, home page.
* Run them: `docker compose exec backend php artisan test` and `docker compose exec frontend npm test`.

## 6. Trade-offs to mention

* Same-origin proxy and cookie sessions need a single-origin deployment in production (or Sanctum domain config).
* Demo credentials are public by design; the seeder is for local use.
* No image resizing or CDN: out of scope for the exercise, easy to add behind the avatar endpoint.
* No email verification or registration: not in items 1 to 3.
* The per-ability gates are application-wide on purpose; per-resource rules (profiles) use a policy.
