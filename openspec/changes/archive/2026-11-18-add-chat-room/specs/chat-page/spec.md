# Spec Delta

## Purpose

The chat screen people actually use, on the application's main page.

## ADDED Requirements

### Requirement: Chat on the main page
The web client SHALL show the shared room on the main page: the message list with each message's sender (picture or initial, name), text and time, and a box to write a new message.

#### Scenario: Reading
- **WHEN** a signed-in user opens the main page
- **THEN** the latest messages are listed oldest to newest and the view is scrolled to the newest

#### Scenario: Sending
- **WHEN** the user types a message and sends it
- **THEN** it appears in the list and the box is cleared

#### Scenario: Send with the keyboard
- **WHEN** the user presses Enter in the box
- **THEN** the message is sent; Shift+Enter adds a new line instead

#### Scenario: Server rejects the message
- **WHEN** the server refuses a message
- **THEN** the page shows the error and keeps the typed text

#### Scenario: No permission to send
- **WHEN** the user lacks the `send-messages` ability
- **THEN** the box is disabled and the messages remain readable

#### Scenario: Own messages
- **WHEN** a message was sent by the signed-in user
- **THEN** it is visually distinguished from other people's messages

#### Scenario: Older messages
- **WHEN** older messages exist
- **THEN** the page offers a way to load them without losing the current ones

### Requirement: Main page text element
The main page SHALL contain a text element, one pixel in size and white, whose text is exactly "The dark side consumes you. Have you ever heard of the tragedy of Darth Plagueis the wise?".

#### Scenario: Element present
- **WHEN** the main page is shown
- **THEN** the page contains that exact text in a 1px white element
