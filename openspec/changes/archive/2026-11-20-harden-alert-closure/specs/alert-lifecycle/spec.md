## ADDED Requirements

### Requirement: Closing is final and complete
Once an alert has ended, the system SHALL keep it and all its responses unchanged, and SHALL start the next alert from an empty set of responses.

#### Scenario: Full lifecycle
- **WHEN** an administrator starts an alert, a user picks a square, the administrator ends the alert, a second user tries to pick, and then the administrator starts another alert
- **THEN** the ended alert still shows only the first pick and its end time, the late pick was refused with 409, and the new alert is active with no responses

#### Scenario: Restore after the end
- **WHEN** a permitted user requests the current alert after it ended
- **THEN** the system responds with status ended, the end time and every response stored before the end
