# chat-messages Specification

## Purpose
Lets signed-in people talk in a single shared room and keeps what was said.

## Requirements

### Requirement: Post a message
The system SHALL let a signed-in user who has the `send-messages` ability post a text message to the shared room. The message SHALL be stored with its sender and the time it was posted.

#### Scenario: Valid message
- **WHEN** a permitted user posts a non-empty message of at most 2000 characters
- **THEN** the system stores it and responds 201 with the message, its sender's id, name and picture address, and its time

#### Scenario: Surrounding whitespace
- **WHEN** a message has leading or trailing whitespace
- **THEN** the stored text is trimmed

#### Scenario: Empty or blank message
- **WHEN** the message is missing, empty or only whitespace
- **THEN** the system responds 422 and stores nothing

#### Scenario: Message too long
- **WHEN** the message is longer than 2000 characters
- **THEN** the system responds 422 and stores nothing

#### Scenario: Not allowed to send
- **WHEN** a signed-in user without the `send-messages` ability posts a message
- **THEN** the system responds 403 and stores nothing

#### Scenario: Visitor
- **WHEN** a visitor who is not signed in posts a message
- **THEN** the system responds 401

### Requirement: Sender cannot be forged
The system SHALL always record the signed-in user as the sender, ignoring any sender information in the request.

#### Scenario: Sender field in request
- **WHEN** a request includes a `user_id` of another person
- **THEN** the message is stored as sent by the signed-in user

### Requirement: Read message history
The system SHALL give every signed-in user the messages of the room, oldest first within a page, newest page first, 50 per page, each with sender id, name, picture address and time. A client SHALL be able to request messages older than a given message.

#### Scenario: Latest messages
- **WHEN** a signed-in user requests the history
- **THEN** the system returns the 50 most recent messages in chronological order and says whether older ones exist

#### Scenario: Older messages
- **WHEN** the user requests messages older than a given message id
- **THEN** the system returns the previous page, and none of the newer messages

#### Scenario: Empty room
- **WHEN** nobody has written yet
- **THEN** the system returns an empty list

#### Scenario: Private data
- **WHEN** history is returned
- **THEN** senders show only id, name and picture address, never email, phone or address

#### Scenario: Visitor
- **WHEN** a visitor requests the history
- **THEN** the system responds 401
