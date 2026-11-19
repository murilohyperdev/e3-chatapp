# Spec Delta

## Purpose

Defines the two user types of the application and the actions each type may perform, and guarantees that the server refuses any action outside a user's type, however the request is made.

## ADDED Requirements

### Requirement: Every user has exactly one type
The system SHALL store a type for each user, either regular user or administrator, and SHALL default new users to regular user.

#### Scenario: New account
- **WHEN** a user is created without an explicit type
- **THEN** the user is a regular user

#### Scenario: Seeded accounts
- **WHEN** the demo data is loaded
- **THEN** at least one administrator and at least one regular user exist, each able to sign in

### Requirement: Abilities of a regular user
The system SHALL allow every signed-in user, whatever their type, to send chat messages, receive alerts, submit locations and view locations.

#### Scenario: Regular user abilities
- **WHEN** the abilities of a regular user are checked
- **THEN** sending messages, receiving alerts, submitting locations and viewing locations are allowed
- **AND** starting alerts and ending alerts are denied

### Requirement: Abilities of an administrator
The system SHALL allow administrators to do everything a regular user can do and also to start alerts and end alerts.

#### Scenario: Administrator abilities
- **WHEN** the abilities of an administrator are checked
- **THEN** every ability of a regular user is allowed
- **AND** starting alerts and ending alerts are allowed

### Requirement: Server-side enforcement
The system SHALL deny a request whose user lacks the required ability with 403 Forbidden, regardless of what the client interface shows, and SHALL answer 401 Unauthorized when nobody is signed in.

#### Scenario: Regular user calls an administrator-only endpoint directly
- **WHEN** a signed-in regular user sends a request to an endpoint that requires an administrator ability
- **THEN** the system responds 403 and performs no action

#### Scenario: Administrator calls the same endpoint
- **WHEN** a signed-in administrator sends the same request
- **THEN** the system allows it

#### Scenario: Visitor calls a protected endpoint
- **WHEN** a visitor who is not signed in sends the request
- **THEN** the system responds 401

### Requirement: Types cannot be changed through ordinary input
The system SHALL ignore a user type supplied in any request that creates or updates user data, so a user cannot promote themselves.

#### Scenario: Role supplied in a request
- **WHEN** a request that updates user data includes a role value
- **THEN** the stored type of the user does not change
