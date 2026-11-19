# Proposal

## Why

People in the chat need to be recognisable and reachable: a name, a picture, and contact details they control. Without profiles every user is just an email address, and the later chat and alert screens have nothing to show next to a message or a location. The brief also asks for a directory of everyone with their picture and type.

## What Changes

- Add phone, address and profile picture to users.
- Let a signed-in user edit only their own name, phone and address, and upload or remove only their own picture, with validation on every field and on the upload.
- Refuse (403) any attempt to edit another user's profile, administrators included, and ignore fields that are not editable (email, role).
- Add a paginated directory of all users showing name, picture and user type, and nothing private about other people.
- Add React pages: "My profile" (edit form with picture upload) and "People" (directory), reachable from the home page.

## Capabilities

### New Capabilities
- `user-profiles`: viewing and editing one's own profile data and picture, with validation and ownership rules.
- `user-directory`: the list of users with names, pictures and user types visible to every signed-in user.

### Modified Capabilities

None. (The current-user response gains profile fields, which the new profile capability specifies, so the existing `user-auth` requirement text does not change.)

## Impact

- Backend: migration (`phone`, `address`, `avatar_path`), `UserPolicy`, form requests, profile/avatar/directory controllers, two resources (self vs public), public storage link, tests.
- Frontend: router additions, profile and directory pages, API client helpers (multipart upload), Vite proxy for `/storage`.
- Docs: README endpoints and storage note.
- Out of scope: email change, admin editing of other profiles, image cropping, search, avatars on a CDN.
