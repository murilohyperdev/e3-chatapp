# Tasks

## 1. Data and ownership

- [x] 1.1 Add the migration for `phone`, `address`, `avatar_path`, update `#[Fillable]` (name, phone, address only), and add an `avatar_url` accessor; verify with `php artisan migrate` and a unit test that `avatar_path` and `role` are not mass assignable while `phone` is.
- [x] 1.2 Add `UserPolicy::update` (owner only); verify with a unit test: owner allowed, other user denied, administrator denied.

## 2. Profile API

- [x] 2.1 Add `UpdateProfileRequest`, `ProfileController@update` for `PATCH /api/users/{user}`, and extend `UserResource` with phone, address and avatar_url; verify with feature tests: valid update, each invalid field, clearing fields, email/role ignored, other user 403, administrator 403, visitor 401.
- [x] 2.2 Add `UploadAvatarRequest`, avatar upload and delete endpoints using the public disk, deleting the replaced file; verify with `Storage::fake` feature tests: valid upload and file stored, old file removed, non-image, wrong format, too large, too small, missing file, other user 403, remove picture.
- [x] 2.3 Create the `storage:link` in the container entrypoint and document it; verify `curl` of an uploaded file through `localhost:8000/storage/...` returns the image.

## 3. Directory API

- [x] 3.1 Add `DirectoryUserResource` and `GET /api/users` (ordered by name, 12 per page); verify with feature tests: ordering, second page, exact key set without email/phone/address, own entry also public-only, visitor 401.

## 4. Frontend

- [x] 4.1 Extend the API client and `api/users.ts` (FormData upload, profile update, directory page) and the `User` type; verify with client unit tests for multipart bodies (no JSON content type).
- [x] 4.2 Add `ProfilePage` with form, field errors, picture upload and removal, and refresh the signed-in user after saving; verify with component tests (success, server field error, upload).
- [x] 4.3 Add `PeoplePage`, home navigation and routes, and the `/storage` Vite proxy; verify with component tests (list with role chips, initial fallback, load more), `npm run build` and `npm run lint`.

## 5. Docs and end-to-end check

- [x] 5.1 Update the README (endpoints, storage, validation limits); verify with `php artisan test`, pint, `npm test`, and a manual browser run editing a profile, uploading a picture, and viewing the directory as two different users.

## Workflow follow-up

- Commit item 3 locally, then run `/opsx:archive` for this change.
