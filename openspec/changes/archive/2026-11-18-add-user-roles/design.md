# Design

## Context

Auth is in place (see the archived `add-authentication` change). `users` has no type column. Chat and alert features do not exist, so there are no routes or models to attach rules to yet. The abilities come from the exercise brief: everybody chats, receives alerts and submits/views locations; only administrators start and end alerts.

## Goals / Non-Goals

**Goals:** a single source of truth for who can do what; enforcement that is one line per future route; tests proving the rules for both types, including direct requests.

**Non-Goals:** a role-management UI, multiple roles per user, permission overrides, per-resource policies (the profile policy arrives with the profiles change).

## Decisions

1. **String column + backed enum.** `users.role` is a string defaulting to `user`, cast to a `UserRole` enum (`User`, `Administrator`). Alternatives: a `roles` table with a pivot (overkill for two fixed types), a boolean `is_admin` (does not read as a type and blocks a third type), a database enum type (hard to migrate). The string with an enum cast keeps validity in PHP and the migration trivial.
2. **Abilities live on the enum.** `UserRole::abilities()` returns the list of ability names for each role and `can(string)` answers a check. The mapping is one `match`, so the permission table in the README, the gates and the tests all read from one place. Alternative: scatter `if ($user->isAdmin())` through controllers (what we are avoiding).
3. **Gates, not policies, for these abilities.** A policy is tied to a model; these are application-wide capabilities with no model yet. `AppServiceProvider` (or a dedicated provider) loops over the ability names and registers `Gate::define($ability, fn (User $user) => $user->role->can($ability))`. Alternative: permission packages (spatie/laravel-permission) are heavy for two fixed roles.
4. **Enforcement via the `can:` route middleware.** Future routes declare `->middleware(['auth:sanctum', 'can:start-alerts'])`; unauthenticated gives 401, forbidden gives 403 as JSON. Controllers can additionally use `Gate::authorize` or `$request->user()->can(...)`.
5. **Role is not mass assignable.** It stays out of `#[Fillable]`; the seeder and factory set it explicitly with `forceFill` or a factory state. This makes profile updates in the next change safe by construction, and a test pins it.
6. **Expose `role` and `abilities` on `UserResource`** (abilities as a name → boolean map for all defined abilities) so the SPA can show or hide buttons; the SPA never decides.
7. **Seed data.** `admin@example.com` (administrator), `user@example.com` (user) and several factory-made users with a deterministic password for demo, all idempotent. Factory gets `administrator()` state.
8. **Test the middleware with a temporary route** registered in the test, since real alert routes do not exist yet. This proves 401/403/200 without inventing product endpoints.

## Risks / Trade-offs

- [Abilities defined before their features exist] → They are named after the brief and covered by unit tests; later changes only add routes.
- [Gate names are strings] → Constants on an `Ability` enum avoid typos; the gates and resource iterate over that enum.
- [Demo passwords are known] → Seeding is documented as local/demo only.
