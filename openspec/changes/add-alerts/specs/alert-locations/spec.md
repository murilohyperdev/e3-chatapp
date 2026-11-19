# Spec Delta

## Purpose

Lets each person say where they are during an alert by picking one of four squares.

## ADDED Requirements

### Requirement: Pick a square
The system SHALL let a signed-in user with the `submit-locations` ability pick exactly one of the four squares (`a`, `b`, `c`, `d`) for the active alert. The administrator who started the alert picks like everyone else.

#### Scenario: Valid pick
- **WHEN** a permitted user picks a valid square while the alert is active
- **THEN** the system stores one response for that user and alert and responds 201 with the updated alert

#### Scenario: Shared square
- **WHEN** two users pick the same square
- **THEN** both responses are stored and both names belong to that square

#### Scenario: Invalid square
- **WHEN** the square is missing or not one of `a` to `d`
- **THEN** the system responds 422 and stores nothing

#### Scenario: Not allowed to submit
- **WHEN** a signed-in user without `submit-locations` sends a pick directly
- **THEN** the system responds 403 and stores nothing

### Requirement: One final response per user per alert
The system SHALL keep at most one response per user per alert, enforced by the database. The first pick is final.

#### Scenario: Second pick
- **WHEN** a user who already picked sends another pick for the same alert
- **THEN** the system responds 409 and the stored square does not change

#### Scenario: Concurrent picks
- **WHEN** the same user sends two picks at the same time
- **THEN** exactly one is stored and the other receives 409

#### Scenario: New alert, new pick
- **WHEN** a user picked in an earlier alert and a new alert starts
- **THEN** the user can pick again for the new alert

### Requirement: Reject picks outside an active alert
The system SHALL reject a pick for an alert that has ended.

#### Scenario: Alert already ended
- **WHEN** a user sends a pick for an ended alert
- **THEN** the system responds 409 and stores nothing

#### Scenario: Pick racing with the end
- **WHEN** a pick and the end request arrive at the same time
- **THEN** the pick is either stored before the end or rejected, never stored after it
