# alert-page Specification

## Purpose
What people see and click during an alert on the main page.

## Requirements

### Requirement: Location modal
The web client SHALL open a modal on every session of a user who may submit locations when an alert is active and that user has not picked yet. The modal SHALL show four labeled squares in a 2x2 grid and SHALL stay open until the user picks.

#### Scenario: Alert starts while the page is open
- **WHEN** an alert starts and the user has the page open
- **THEN** the modal appears automatically without reloading

#### Scenario: Pick
- **WHEN** the user clicks a square
- **THEN** the pick is sent, the modal closes and the user's name shows in that square

#### Scenario: Pick rejected
- **WHEN** the server rejects the pick
- **THEN** the modal stays open and shows the error

#### Scenario: Reload before picking
- **WHEN** the user reloads the page during an active alert without having picked
- **THEN** the modal opens again

#### Scenario: Already picked
- **WHEN** the user reloads after picking
- **THEN** no modal opens and the board shows the pick

#### Scenario: No permission to submit
- **WHEN** the user lacks `submit-locations`
- **THEN** no modal opens and the board is still shown

### Requirement: Shared board
The web client SHALL show, for the latest alert, the same 2x2 grid with each square's label and the names of everyone who picked it, updating live.

#### Scenario: Several in one square
- **WHEN** two users pick the same square
- **THEN** both names appear in that square in every session

#### Scenario: Alert ended
- **WHEN** the alert ends
- **THEN** the board stays with an "ended" notice, the modal closes and no more picks are possible

#### Scenario: No alert
- **WHEN** there is no alert
- **THEN** no board or modal is shown

### Requirement: Administrator controls
The web client SHALL show a start button to users with `start-alerts` when no alert is active and an end button when one is, and SHALL show nothing of the kind to others.

#### Scenario: Administrator
- **WHEN** an administrator views the main page
- **THEN** they see the start button, or the end button while an alert is active

#### Scenario: Regular user
- **WHEN** a user without `start-alerts` views the page
- **THEN** no start or end button is present

#### Scenario: Chat stays available
- **WHEN** the modal or board is shown
- **THEN** the chat remains visible and usable

### Requirement: Stale modal closes
The location modal SHALL close once the client learns the alert has ended, whether from a live event, a catch-up or a refused pick.

#### Scenario: Pick refused after the end
- **WHEN** a user whose client missed the end picks a square and the server answers 409
- **THEN** the modal closes and the board shows the alert as ended with the responses stored before the end

#### Scenario: End refused for an administrator
- **WHEN** an administrator ends an alert that another administrator already ended
- **THEN** the board shows the alert as ended and the end button disappears
