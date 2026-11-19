# Tasks

## 1. Roles and abilities

- [x] 1.1 Add the migration for `users.role` (default `user`), the `UserRole` and `Ability` enums, cast the column, keep it out of `Fillable`, and add `administrator()` to `UserFactory`; verify with `php artisan migrate` and a unit test that new users default to `user`.
- [x] 1.2 Register one gate per ability from the role's ability list; verify with unit tests that a regular user is denied only `start-alerts` and `end-alerts` and an administrator is allowed all six.

## 2. Enforcement and exposure

- [x] 2.1 Return `role` and `abilities` from `UserResource` (current-user endpoint); verify with feature tests for a regular user and an administrator, and update the existing exact-JSON test.
- [x] 2.2 Prove `can:` middleware on a test-only route: 401 for visitors, 403 for regular users, 200 for administrators; verify with feature tests including a direct request with the user's own session.
- [x] 2.3 Verify a `role` value in a mass-assignment attempt does not promote a user; verify with a unit test.

## 3. Seed data, frontend and docs

- [x] 3.1 Seed an administrator, a regular user and extra demo users idempotently; verify `php artisan db:seed` twice leaves the same row count and both main accounts can sign in.
- [x] 3.2 Add `role` and `abilities` to the frontend `User` type and show the role on the home page; verify with a component test, `npm run build` and `npm run lint`.
- [x] 3.3 Update the README with demo accounts and the abilities table; verify with `php artisan test`, pint and a manual sign-in as each account.

## Workflow follow-up

- Commit item 2 locally, then run `/opsx:archive` for this change.
