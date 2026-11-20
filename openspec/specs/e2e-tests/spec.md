# e2e-tests Specification

## Purpose
Defines the browser-level journeys the end-to-end suite must prove with two independent sessions (chat, alerts, permissions, recovery, password reset), and the safety rules that let it run against the development stack.

## Requirements

### Requirement: Two independent sessions are exercised in real browsers
The end-to-end suite SHALL drive an administrator and a regular user in separate browser contexts (separate cookies and WebSocket connections) against the running stack.

#### Scenario: Chat message reaches the other session without a refresh
- **WHEN** one session sends a chat message
- **THEN** the other session shows it with the sender name, without reloading the page

#### Scenario: Alert is delivered live and a location pick is shared
- **WHEN** the administrator starts an alert
- **THEN** the user's session opens the location modal without a reload, and after the user picks a square both sessions show the user's name in that square

#### Scenario: Ending an alert reaches the other session
- **WHEN** the administrator ends the alert
- **THEN** the user's session shows the alert as ended and picking is no longer possible

### Requirement: Permissions are enforced as seen from the browser and by direct requests
The suite SHALL prove a regular user has no alert start/end controls and that the server refuses the same actions sent directly.

#### Scenario: Regular user tries admin actions directly
- **WHEN** a signed-in regular user sends a start-alert request to the API
- **THEN** the response is 403 and no alert is created

#### Scenario: Visitor tries a protected endpoint
- **WHEN** a request without a session asks for the current alert
- **THEN** the response is 401

### Requirement: Recovery after refresh and reconnection is proven
The suite SHALL prove that a reloaded or reconnected session shows the current state, including an alert that ended while the session was offline.

#### Scenario: Reload keeps the pick and the alert
- **WHEN** the user reloads during an active alert after picking
- **THEN** the board still shows the pick and the modal does not reopen

#### Scenario: Alert ended while offline
- **WHEN** the user's browser is offline while the administrator ends the alert, and then comes back online
- **THEN** the user's session shows the alert as ended without a manual reload

### Requirement: Password recovery works through the real email
The suite SHALL request a reset link, read the email from the local Mailpit inbox, follow the link, set a new password and sign in with it.

#### Scenario: Full recovery
- **WHEN** a user requests a reset, opens the emailed link and submits a new password
- **THEN** signing in with the new password succeeds and the old one is refused

### Requirement: The suite is safe for the development database
The suite MUST NOT run migrations or wipe data, MUST end any alert it starts or finds active, MUST restore any password it changes, and MUST tag its own chat messages so they are identifiable.

#### Scenario: A previous alert is still active
- **WHEN** the suite starts while an alert is active
- **THEN** the administrator ends it before the scenarios run

### Requirement: One command can include the browser suite
`scripts/test.sh --e2e` SHALL run the end-to-end stage after the existing stages and include it in the pass/fail summary; without the flag the stage is skipped.

#### Scenario: Flag omitted
- **WHEN** `scripts/test.sh` runs without `--e2e`
- **THEN** no browser is launched and the summary lists the stage as skipped
