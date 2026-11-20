## ADDED Requirements

### Requirement: Stale modal closes
The location modal SHALL close once the client learns the alert has ended, whether from a live event, a catch-up or a refused pick.

#### Scenario: Pick refused after the end
- **WHEN** a user whose client missed the end picks a square and the server answers 409
- **THEN** the modal closes and the board shows the alert as ended with the responses stored before the end

#### Scenario: End refused for an administrator
- **WHEN** an administrator ends an alert that another administrator already ended
- **THEN** the board shows the alert as ended and the end button disappears
