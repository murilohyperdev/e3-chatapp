# user-directory Specification

## Purpose
Gives every signed-in user a way to see who else uses the application, by name, picture and user type, without exposing anyone's private details.

## Requirements

### Requirement: List users
The system SHALL give every signed-in user a paginated list of all users, ordered by name, showing each user's name, picture address and user type.

#### Scenario: Signed-in user lists users
- **WHEN** a signed-in user requests the directory
- **THEN** the system returns users ordered by name with id, name, picture address and user type, plus pagination information

#### Scenario: Pagination
- **WHEN** there are more users than fit on one page and a later page is requested
- **THEN** the system returns that page's users

#### Scenario: Visitor
- **WHEN** a visitor who is not signed in requests the directory
- **THEN** the system responds 401

### Requirement: Directory hides private data
The system SHALL NOT include email, phone, address or password data of any user in the directory, including the requester's own entry.

#### Scenario: Private fields absent
- **WHEN** the directory is returned
- **THEN** no entry contains email, phone or address fields

### Requirement: Directory page
The web client SHALL show the directory with each person's name, picture (or an initial when none) and user type, with a way to load further pages.

#### Scenario: Viewing people
- **WHEN** a signed-in user opens the people page
- **THEN** the client lists users with their pictures and user types

#### Scenario: Missing picture
- **WHEN** a user has no picture
- **THEN** the client shows an avatar with the user's initial
