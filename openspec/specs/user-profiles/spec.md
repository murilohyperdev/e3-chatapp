# user-profiles Specification

## Purpose
Lets each signed-in user maintain their own name, phone, address and profile picture, while guaranteeing that nobody can change another person's profile.

## Requirements

### Requirement: View own profile
The system SHALL return the signed-in user's own profile, including phone, address and picture address, in the current-user response.

#### Scenario: Profile fields present
- **WHEN** a signed-in user requests their own data
- **THEN** the response includes name, email, phone, address and the picture address, with empty values as null

### Requirement: Edit own profile data
The system SHALL let a signed-in user update their own name, phone and address, and SHALL reject invalid values with field errors.

#### Scenario: Valid update
- **WHEN** a user submits a valid name, phone and address for their own profile
- **THEN** the system saves them and returns the updated profile

#### Scenario: Invalid values
- **WHEN** a user submits an empty name, a name over 100 characters, a phone with letters or an address over 255 characters
- **THEN** the system rejects the request with a validation error naming each invalid field and saves nothing

#### Scenario: Clearing optional fields
- **WHEN** a user submits empty phone or address values
- **THEN** the system clears those fields

#### Scenario: Non-editable fields
- **WHEN** a user's update request includes an email or a user type
- **THEN** the system ignores those values and leaves them unchanged

### Requirement: Only the owner can edit a profile
The system SHALL refuse with 403 any request by a signed-in user to change another user's data or picture, whatever the requester's user type, and SHALL answer 401 to visitors.

#### Scenario: Editing someone else's profile
- **WHEN** a signed-in user sends an update for another user's profile
- **THEN** the system responds 403 and the other user's data is unchanged

#### Scenario: Administrator editing someone else's profile
- **WHEN** an administrator sends an update for another user's profile
- **THEN** the system responds 403

#### Scenario: Visitor
- **WHEN** a visitor who is not signed in sends a profile update
- **THEN** the system responds 401

### Requirement: Upload a profile picture
The system SHALL let a user upload a JPEG, PNG or WebP picture of at most 2 MB and between 64 and 4096 pixels per side as their own profile picture, replacing and deleting the previous one.

#### Scenario: Valid upload
- **WHEN** a user uploads a valid image
- **THEN** the system stores it, returns the profile with the new picture address, and removes the previous file

#### Scenario: Rejected uploads
- **WHEN** the file is not an image, is in another format, exceeds 2 MB, or is outside the allowed dimensions
- **THEN** the system rejects it with a validation error and keeps the current picture

#### Scenario: Missing file
- **WHEN** the upload request contains no file
- **THEN** the system rejects it with a validation error

### Requirement: Remove a profile picture
The system SHALL let a user remove their own profile picture.

#### Scenario: Removing the picture
- **WHEN** a user removes their picture
- **THEN** the stored file is deleted and the picture address becomes null

### Requirement: Profile pages
The web client SHALL provide a page where a signed-in user edits their profile and manages their picture, showing server validation errors next to the fields.

#### Scenario: Saving the form
- **WHEN** the user saves valid changes
- **THEN** the client confirms the save and shows the updated values

#### Scenario: Server rejects a field
- **WHEN** the server returns a validation error
- **THEN** the client shows the message under the matching field
