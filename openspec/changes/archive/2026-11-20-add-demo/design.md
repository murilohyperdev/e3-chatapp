## Context

The Playwright e2e suite (item 7) already has helpers for sessions, API calls and Mailpit. Item 8 is a live demonstration, so the extra need is pacing, visibility and a script, not new assertions.

## Goals / Non-Goals

**Goals:** a repeatable, watchable run of all seven scenarios; a written script for the live call; optional video recording as a fallback.
**Non-Goals:** changing application code, replacing the e2e tests, the final README.

## Decisions

- **Playwright library script, not `@playwright/test`.** A plain TypeScript script (run by Node's built-in type stripping) keeps pacing and captions simple and has no test timeouts or reporter. It reuses `e2e/support/helpers.ts`.
- **Captions are injected overlays** (`page.evaluate` adds a fixed banner, re-added on navigation via `addInitScript`), so the audience and the recording see which scenario is running without app changes.
- **Two windows side by side** in headed mode through Chromium `--window-position`/`--window-size`; videos via `recordVideo` per context when `DEMO_RECORD=1`.
- **Pace** is a single `PACE` multiplier (`DEMO_SLOW`, default 1) applied to short pauses.
- **State safety** reuses `endActiveAlert`, and the password step reuses the Mailpit helpers and restores the original password in `finally`, waiting out the one-reset-per-minute throttle.
- **Script in `docs/DEMO.md`** is the primary live-review aid: the manual flow is what the reviewer expects; the runner is the rehearsal and the fallback.

## Risks / Trade-offs

- Password recovery can wait up to a minute because of the throttle → the runner places it last and says so in a caption.
- Headed mode needs a display; headless with recording works anywhere.
