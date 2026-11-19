# Proposal

## Why

The exercise is a chat application, and so far people can only sign in, hold a profile and see each other in a directory. They have no place to talk. The next feature (alerts) also needs a way to push events to open browsers, so the delivery mechanism chosen here has to be reusable.

## What Changes

- Add one shared chat room: any signed-in user with the `send-messages` ability can post a text message; every signed-in user can read the history, each message showing its sender, picture and time.
- Persist messages in the database and serve the latest ones on page load (older ones on demand).
- Deliver new messages to every other open session automatically, without a page refresh, over a WebSocket server (Laravel Reverb) with Laravel Echo in the browser. The channel is private and authorised with the existing session cookie.
- Put chat on the application's main page, replacing the "coming next" placeholder.
- Add a 1px white text element on the main page with the exact sentence required by the brief.
- Add the `reverb` service to Docker Compose and route WebSocket traffic through the Vite proxy so the browser stays on one origin.

## Capabilities

### New Capabilities
- `chat-messages`: posting and reading messages (validation, permission, history, pagination).
- `chat-realtime`: delivering new messages to other sessions live, over a private channel only signed-in users can join.
- `chat-page`: the chat UI on the main page, including the required 1px text element.

### Modified Capabilities

None.

## Impact

- Backend: `messages` migration and model, `MessageController`, form request, resource, `NewMessage` broadcast event, `routes/channels.php`, broadcasting config, `laravel/reverb` dependency, tests.
- Frontend: `laravel-echo` and `pusher-js` dependencies, Echo setup, chat API helpers, chat hook and components, `HomePage` change, Vite proxy for WebSocket paths, tests.
- Infrastructure: new `reverb` Compose service, `.env.example` keys.
- Docs: README, both walkthroughs.
- Out of scope: private/direct messages, multiple rooms, editing or deleting messages, attachments, typing indicators, read receipts, moderation. Alerts (item 5) reuse the transport but are a separate change.
