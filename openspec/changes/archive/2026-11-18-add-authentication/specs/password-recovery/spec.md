# Spec Delta

## Purpose

Lets a user who has forgotten their password regain access by receiving a one-time link by email and choosing a new password.

## ADDED Requirements

### Requirement: Request a password reset link
The system SHALL send a password reset email containing a link to the web client when a registered email is submitted, and SHALL respond identically whether or not the email is registered.

#### Scenario: Registered email
- **WHEN** a visitor submits a registered email on the forgot-password form
- **THEN** the system sends an email to that address with a link to the client's reset-password page carrying the token and the email, and responds with a generic confirmation message

#### Scenario: Unknown email
- **WHEN** a visitor submits an email that is not registered
- **THEN** the system sends no email and responds with the same generic confirmation message

#### Scenario: Invalid email format
- **WHEN** a visitor submits a value that is not a valid email address
- **THEN** the system rejects the request with a validation error

#### Scenario: Repeated requests
- **WHEN** a visitor requests a reset link again within the throttle window
- **THEN** the system does not send another email and tells the visitor to wait

### Requirement: Reset the password with a token
The system SHALL let a visitor set a new password when they present a valid, unexpired reset token for their email.

#### Scenario: Valid token
- **WHEN** a visitor submits a valid token, the email, a new password and its confirmation
- **THEN** the system stores the new password, invalidates the token, and lets the user sign in with the new password and not the old one

#### Scenario: Invalid or expired token
- **WHEN** a visitor submits a token that is wrong, already used or expired
- **THEN** the system rejects the request with a validation error and leaves the password unchanged

#### Scenario: Weak or unconfirmed password
- **WHEN** the new password is shorter than eight characters or does not match its confirmation
- **THEN** the system rejects the request with a validation error and leaves the password unchanged

### Requirement: Password recovery pages
The web client SHALL provide a forgot-password page and a reset-password page reachable without signing in.

#### Scenario: Reset link opened
- **WHEN** a visitor opens the emailed link
- **THEN** the client shows the reset-password form with the email prefilled and, after success, directs them to sign in

#### Scenario: Reset fails
- **WHEN** the server rejects the reset
- **THEN** the client shows the server's error message next to the form
