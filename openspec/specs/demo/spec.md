# demo Specification

## Purpose
TBD - created by archiving change add-demo. Update Purpose after archive.

## Requirements

### Requirement: The demonstration covers every scenario of item 8 with two independent sessions
The demo runner and script SHALL show an administrator session and a regular user session (separate browser contexts) and cover chat, alert delivery, location updates, permission enforcement, ending an alert, refresh/reconnection recovery and password recovery.

#### Scenario: Full run
- **WHEN** the demo runner is executed against the running stack
- **THEN** every scenario is performed in order, each preceded by a visible caption naming it, and the run exits successfully

#### Scenario: Script for the live review
- **WHEN** the presenter opens `docs/DEMO.md`
- **THEN** it lists the pre-flight checks and, for each scenario, the actions per session and the expected result

### Requirement: The demo is watchable and recordable
The runner SHALL pace its steps for a human audience, show two windows side by side when run headed, and SHALL be able to save one video per session when asked.

#### Scenario: Recording
- **WHEN** the runner is started with recording enabled
- **THEN** one video file per session is written to a recordings folder that is not committed

### Requirement: The demo is safe for the development stack
The runner SHALL start from a known state, leave no active alert behind, restore any password it changed, and never run migration commands.

#### Scenario: Re-running
- **WHEN** the demo is run twice in a row
- **THEN** both runs succeed and the demo accounts still sign in with their documented password
