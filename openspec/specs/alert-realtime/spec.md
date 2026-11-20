# alert-realtime Specification

## Purpose
Makes alert state live: every connected session sees the alert start, each pick and the end without reloading.

## Requirements

### Requirement: Live alert state
The system SHALL broadcast the full alert state (status, responses with names and squares) on the private channel `alerts` whenever an alert starts, a response is stored or the alert ends. Every message SHALL carry a revision so clients can ignore stale ones.

#### Scenario: Alert starts
- **WHEN** an administrator starts an alert
- **THEN** every session connected to the channel receives the new active alert

#### Scenario: A user picks
- **WHEN** a user picks a square
- **THEN** every connected session, including the picker's, receives the alert with that user's name in that square

#### Scenario: Alert ends
- **WHEN** an administrator ends the alert
- **THEN** every connected session receives the ended alert

#### Scenario: Stale message
- **WHEN** a client receives state with a lower revision than the one it already shows for the same alert
- **THEN** it ignores it

#### Scenario: Failed request
- **WHEN** a request is rejected (validation, permission or conflict)
- **THEN** nothing is broadcast

#### Scenario: Broadcaster down
- **WHEN** the WebSocket server is unreachable while a change is stored
- **THEN** the request still succeeds and the change is kept

### Requirement: Private alerts channel
The system SHALL only let signed-in users with `receive-alerts` and `view-locations` join the `alerts` channel.

#### Scenario: Permitted subscriber
- **WHEN** a signed-in user with both abilities subscribes
- **THEN** the subscription is authorised

#### Scenario: Visitor or unpermitted user
- **WHEN** a visitor, or a user lacking either ability, tries to subscribe
- **THEN** the subscription is refused

### Requirement: Catch-up after a lost connection
The web client SHALL show the true alert state after a lost connection returns.

#### Scenario: Missed events
- **WHEN** the live connection drops and an alert starts, receives picks or ends meanwhile
- **THEN** after reconnecting the client fetches the current alert and shows it

### Requirement: Chat is independent
Alert traffic SHALL NOT use or disturb the `chat` channel.

#### Scenario: Chat during an alert
- **WHEN** an alert is active
- **THEN** messages are still sent and received live as before

### Requirement: Resynchronise when state may be stale
The web client SHALL fetch the current alert whenever its state may be stale, not only after the WebSocket reconnects.

#### Scenario: Refused because the alert already ended
- **WHEN** a pick or an end request is answered with 409
- **THEN** the client fetches the current alert and shows it

#### Scenario: Tab visible again
- **WHEN** the browser tab becomes visible after being hidden
- **THEN** the client fetches the current alert and shows it

#### Scenario: Browser back online
- **WHEN** the browser reports it is online again
- **THEN** the client fetches the current alert and shows it

#### Scenario: Resync failure
- **WHEN** a resynchronisation request fails
- **THEN** the client keeps what it shows and does not report an error for that request
