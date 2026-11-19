# chat-realtime Specification

## Purpose
Makes the chat feel live: what one person writes shows up for everyone else without reloading.

## Requirements

### Requirement: Live delivery
The system SHALL deliver every newly posted message to all other sessions that are connected to the room, without them reloading or asking again.

#### Scenario: Another session is open
- **WHEN** a user posts a message while a second user has the chat open
- **THEN** the second user sees the message appear, with the sender and time

#### Scenario: Sender does not get a duplicate
- **WHEN** a user posts a message
- **THEN** the sender's own view shows it exactly once

#### Scenario: Message survives a reload
- **WHEN** a user reloads the page after a message was delivered live
- **THEN** the message is still there, loaded from history

### Requirement: Private room channel
The system SHALL only let signed-in users subscribe to the room's live channel.

#### Scenario: Signed-in subscriber
- **WHEN** a signed-in user subscribes to the room channel
- **THEN** the subscription is authorised

#### Scenario: Visitor subscriber
- **WHEN** a visitor who is not signed in tries to subscribe
- **THEN** the subscription is refused

### Requirement: Connection resilience
The web client SHALL show whether live updates are connected, and after a lost connection comes back it SHALL fetch what it missed so no message is lost.

#### Scenario: Connection drops and returns
- **WHEN** the live connection is lost and later restored
- **THEN** messages posted in the meantime appear without a page reload

#### Scenario: Status shown
- **WHEN** the live connection is not established
- **THEN** the page tells the user that live updates are offline
