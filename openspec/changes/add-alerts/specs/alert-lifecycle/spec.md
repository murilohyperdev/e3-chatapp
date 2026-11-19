# Spec Delta

## Purpose

Lets an administrator raise and end an alert, keeps at most one alert active, and lets any session recover the current state.

## ADDED Requirements

### Requirement: Start an alert
The system SHALL let a signed-in user with the `start-alerts` ability start an alert. A new alert SHALL have no location responses.

#### Scenario: Administrator starts an alert
- **WHEN** an administrator starts an alert and none is active
- **THEN** the system responds 201 with the active alert, who started it and no responses

#### Scenario: Not allowed to start
- **WHEN** a signed-in user without `start-alerts` sends a start request directly
- **THEN** the system responds 403 and creates nothing

#### Scenario: Visitor
- **WHEN** a visitor who is not signed in sends a start request
- **THEN** the system responds 401

### Requirement: One active alert at a time
The system SHALL allow at most one active alert, and the database itself SHALL enforce it, so two simultaneous start requests cannot both succeed.

#### Scenario: An alert is already active
- **WHEN** an administrator starts an alert while another is active
- **THEN** the system responds 409 and the existing alert is unchanged

#### Scenario: Concurrent starts
- **WHEN** two start requests arrive at the same time
- **THEN** exactly one creates an alert and the other receives 409

#### Scenario: Start after the previous one ended
- **WHEN** the active alert was ended and an administrator starts another
- **THEN** a new alert is created with no responses, independent of the old one

### Requirement: End an alert
The system SHALL let a signed-in user with the `end-alerts` ability end the active alert, recording when it ended and who ended it.

#### Scenario: Administrator ends the alert
- **WHEN** an administrator ends the active alert
- **THEN** the system responds 200 with the alert marked as ended and keeps all its responses

#### Scenario: Already ended
- **WHEN** someone ends an alert that has already ended
- **THEN** the system responds 409 and the end time does not change

#### Scenario: Not allowed to end
- **WHEN** a signed-in user without `end-alerts` sends an end request directly
- **THEN** the system responds 403 and the alert stays active

### Requirement: Restore the current state
The system SHALL expose the latest alert, active or ended, with all its responses, to users who may receive alerts and view locations, so a reloaded or reconnected session shows the true state.

#### Scenario: Active alert
- **WHEN** a permitted user requests the current alert while one is active
- **THEN** the system responds with it, its status and every response so far

#### Scenario: Ended while offline
- **WHEN** an alert ended while a session was disconnected and that session requests the current alert
- **THEN** the system responds with the alert marked as ended

#### Scenario: No alert yet
- **WHEN** no alert has ever been started
- **THEN** the system responds with an empty result (`data` is null)

#### Scenario: Not allowed to read
- **WHEN** a signed-in user lacking `receive-alerts` or `view-locations` requests it
- **THEN** the system responds 403
