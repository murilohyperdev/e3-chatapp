## ADDED Requirements

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
