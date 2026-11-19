# Design

## Context

Auth and roles are in place. `users` has name, email, password and role. Laravel's default filesystem disk is `local` (private); public files need the `public` disk and a `storage:link` symlink. In development the SPA is served by Vite, which proxies `/api` and `/sanctum`; files under `/storage` need the same treatment so image URLs stay same-origin. See proposal.md for scope.

## Goals / Non-Goals

**Goals:** ownership enforced by a policy; safe uploads; no private data leaking through the directory; small, testable controllers.

**Non-Goals:** image processing (resize/crop), admin override, search, email change.

## Decisions

1. **Columns on `users`.** `phone` (string, null), `address` (string, null), `avatar_path` (string, null). Profile data is one-to-one with the user and small, so a separate table adds a join for nothing. Only `name`, `phone`, `address` are added to `#[Fillable]`; `role`, `email` and `avatar_path` stay unfillable and are set explicitly.
2. **`UserPolicy::update(User $actor, User $target)`** returns `$actor->is($target)`, applied with `$this->authorize('update', $user)` in the controllers. A policy is the right tool here because the rule depends on a model instance (unlike the ability gates). Administrators are deliberately not exempt: the brief says editing another user's profile must be blocked.
3. **Routes**: `PATCH /api/users/{user}` (data), `POST /api/users/{user}/avatar` (multipart upload), `DELETE /api/users/{user}/avatar`, and `GET /api/users` (directory), all under `auth:sanctum`. Putting the id in the URL keeps the resource addressable and lets the policy reject attempts on other ids with a testable 403. Avatar upload is POST because PHP does not parse multipart bodies on PATCH.
4. **Form requests** `UpdateProfileRequest` and `UploadAvatarRequest`. Rules: name `required|string|max:100`; phone `nullable|string|regex:/^\+?[0-9 ()\-]{7,20}$/`; address `nullable|string|max:255`; avatar `required|image|mimes:jpg,jpeg,png,webp|max:2048|dimensions:min_width=64,min_height=64,max_width=4096,max_height=4096`. Controllers only use `validated()`, so extra input (role, email) is dropped. The `mimes` rule checks the real file type, not just the extension; SVG is excluded on purpose (it can carry scripts).
5. **Storage.** Files go to the `public` disk under `avatars/` with a generated hashed name (`store('avatars', 'public')`), the old file is deleted after the new one is saved, and the database stores only the relative path. Alternatives: S3/CDN (unneeded for this scope), storing blobs in Postgres (bloats backups). A `storage:link` is created by the container entrypoint so a fresh clone works.
6. **Two resources.** `UserResource` (self) adds `phone`, `address`, `avatar_url`. `DirectoryUserResource` exposes only `id`, `name`, `avatar_url`, `role`. A single resource with conditionals would make a leak one missed condition away; separate classes make the contract explicit and testable.
7. **Directory** uses `User::orderBy('name')->paginate(12)` with the standard Laravel pagination envelope; `select` limits columns loaded. N+1 is not a concern (no relations).
8. **Frontend.** `ProfilePage` (form + avatar upload/remove) and `PeoplePage` (MUI list/cards with Avatar, role chip, "Load more"), plus a small nav on the home page. The API client gains `FormData` support (no manual `Content-Type`, so the browser sets the multipart boundary). After a successful save the `AuthProvider` user is refreshed so the header shows the new name. Image URLs are relative (`/storage/...`) and work through the proxy.

## Risks / Trade-offs

- [Orphaned files if the database write fails after storing] → Store first, update row, then delete the old file; a failure leaves at most one unreferenced new file, never a broken profile.
- [`dimensions` rule needs GD/readable image] → Part of the `image` rule's requirements, which PHP in the container already provides.
- [Phone regex is permissive] → Intentional: international formats vary; length and character set are bounded.
- [Public avatar URLs are guessable by anyone with the link] → Names are random hashes; avatars are not secret in a directory that every user can see.
