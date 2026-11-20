## ADDED Requirements

### Requirement: Success and failure paths are tested for every feature
The automated suite SHALL cover, for each feature of the exercise (authentication, roles, profiles, chat, alerts, recovery), the successful operation and each failure condition the server enforces: validation errors, unauthenticated (401), forbidden (403), not found (404), conflicts (409) and throttling (429).

#### Scenario: Message throttle is exercised
- **WHEN** a signed-in user posts more than 30 messages within a minute
- **THEN** a test asserts the next request is answered with 429 and no message is stored

#### Scenario: Missing alert ability is exercised on reads
- **WHEN** a signed-in user without the receive-alerts or view-locations ability requests the current alert
- **THEN** a test asserts the response is 403

#### Scenario: Demo accounts are verified
- **WHEN** the database seeder runs, once or twice
- **THEN** tests assert that an administrator and a regular user exist exactly once, can sign in with the documented password, and have the expected roles

### Requirement: Domain rules have unit tests
Pure domain pieces (the location squares, role abilities and alert state) SHALL have unit tests that run without HTTP.

#### Scenario: Alert state helpers
- **WHEN** an alert has no end time, or has one
- **THEN** unit tests assert `isActive` and the `active` scope agree

### Requirement: Frontend session and shell behaviour is tested
The frontend suite SHALL cover session handling (initial check, sign in, sign out, expired session), the application shell and the avatar fallback, including failure paths.

#### Scenario: Session expires
- **WHEN** any API call answers 401 while a user is signed in
- **THEN** a test asserts the user state is cleared

### Requirement: One command runs the whole suite
The repository SHALL provide `scripts/test.sh`, which runs backend tests, frontend tests, lint and type-check, prints a pass/fail summary per stage, and exits non-zero if any stage fails. It MUST NOT run migrations against, or otherwise wipe, the development database.

#### Scenario: Everything passes
- **WHEN** the stack is running and the command is executed
- **THEN** every stage reports success and the exit status is 0

#### Scenario: A stage fails
- **WHEN** one stage fails
- **THEN** the remaining stages still run, the summary marks the failed stage and the exit status is non-zero
