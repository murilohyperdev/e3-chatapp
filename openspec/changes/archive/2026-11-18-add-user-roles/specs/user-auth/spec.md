# Spec Delta

## MODIFIED Requirements

### Requirement: Current user endpoint
The system SHALL return the signed-in user's data, including their type and the abilities that type grants, on request and SHALL reject the request for visitors who are not signed in.

#### Scenario: Signed-in user
- **WHEN** a signed-in user requests their own data
- **THEN** the system returns the user's id, name, email, type and abilities, and never the password

#### Scenario: Visitor not signed in
- **WHEN** a visitor who is not signed in requests the current user
- **THEN** the system responds with 401 Unauthorized
