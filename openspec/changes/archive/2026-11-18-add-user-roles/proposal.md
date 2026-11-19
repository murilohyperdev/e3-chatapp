# Proposal

## Why

The exercise has two kinds of people: regular users and administrators. Administrators alone start and end alerts, and everyone else only takes part. The server must know each person's type and refuse actions the type does not allow, including direct API calls that bypass the UI. Chat and alerts do not exist yet, so the rules have to be defined now in a form those features can plug into.

## What Changes

- Add a `role` to every user: `user` (default) or `administrator`.
- Define the permission set as named abilities: send messages, receive alerts, submit locations and view locations for every signed-in user; start alerts and end alerts for administrators only.
- Enforce abilities on the server so future routes can be protected with one declaration, and refused requests answer 403.
- Expose the signed-in user's role and abilities on the current-user endpoint so the UI can hide controls (the server still decides).
- Seed an administrator, a regular user and a few extra people.
- Prevent anyone from changing a role through ordinary data input.

## Capabilities

### New Capabilities
- `user-roles`: the two user types, the abilities each one has, and server-side enforcement of those abilities.

### Modified Capabilities
- `user-auth`: the current-user endpoint also returns the user's role and abilities.

## Impact

- Backend: migration adding `users.role`, `UserRole` enum, gates in a service provider, `UserFactory` states, seeder, `UserResource`, tests.
- Frontend: `User` type gains `role` and `abilities`; the home page shows the role.
- Docs: README lists demo accounts and the ability table.
- Out of scope: the chat and alert features themselves, role management UI, per-user permission overrides.
