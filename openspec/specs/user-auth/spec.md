# user-auth Specification

## Purpose
Defines how users sign in and out of the application and how the server identifies the current user, so that every other feature can rely on a verified identity.

## Requirements

### Requirement: Sign in with email and password
The system SHALL authenticate a user who submits a registered email and the matching password, and establish a session for that user.

#### Scenario: Valid credentials
- **WHEN** a visitor submits a registered email and the correct password
- **THEN** the system responds successfully with the user's data and the visitor is signed in for later requests

#### Scenario: Wrong password
- **WHEN** a visitor submits a registered email with an incorrect password
- **THEN** the system rejects the request with a validation error on the email field and does not sign the visitor in

#### Scenario: Unknown email
- **WHEN** a visitor submits an email that is not registered
- **THEN** the system rejects the request with the same error as a wrong password

#### Scenario: Missing fields
- **WHEN** a visitor submits the form without an email or a password
- **THEN** the system rejects the request with a validation error naming each missing field

### Requirement: Throttle failed sign-in attempts
The system SHALL temporarily block sign-in attempts for an email and IP address after five consecutive failures.

#### Scenario: Too many failures
- **WHEN** five sign-in attempts for the same email and IP fail in a row and a sixth is made
- **THEN** the system rejects it with a validation error stating how long to wait, even if the password is correct

### Requirement: Sign out
The system SHALL end the current session when a signed-in user signs out.

#### Scenario: Signed-in user signs out
- **WHEN** a signed-in user requests sign out
- **THEN** the system responds with no content and later requests from that session are treated as unauthenticated

### Requirement: Current user endpoint
The system SHALL return the signed-in user's data on request and SHALL reject the request for visitors who are not signed in.

#### Scenario: Signed-in user
- **WHEN** a signed-in user requests their own data
- **THEN** the system returns the user's id, name and email, and never the password

#### Scenario: Visitor not signed in
- **WHEN** a visitor who is not signed in requests the current user
- **THEN** the system responds with 401 Unauthorized

### Requirement: Protected application screens
The web client SHALL show application screens only to signed-in users and SHALL send everyone else to the sign-in page.

#### Scenario: Visitor opens a protected page
- **WHEN** a visitor who is not signed in opens a protected page
- **THEN** the client redirects them to the sign-in page

#### Scenario: Signed-in user opens the sign-in page
- **WHEN** a signed-in user opens the sign-in page
- **THEN** the client redirects them to the home page

#### Scenario: Session expires
- **WHEN** the server answers a request with 401 while the client believes the user is signed in
- **THEN** the client treats the user as signed out and shows the sign-in page
