# Proposal

## Why

Item 8 of the exercise asks for a demonstration with two independent sessions logged in as different user types, covering chat, alert delivery, location updates, permission enforcement, ending alerts, refresh/reconnection recovery and password recovery. It is shown live in the video review. The e2e suite proves each behaviour but is built for assertions, not for being watched. A live demo needs a script to follow, a known starting state, and a fallback recording if something fails on camera.

## What Changes

- New `docs/DEMO.md`: a step-by-step live-review script (what to click in each session, what to say, what the audience should see) for the seven scenarios, plus a pre-flight checklist and a troubleshooting section.
- New guided demo runner `e2e/demo/demo.ts` with `scripts/demo.sh`: opens two browser windows side by side (administrator and user), walks through the seven scenarios at a human pace, shows an on-screen caption for each step, and can record one video per session (headless or headed).
- The runner resets the demo state before and after (ends any active alert, restores the demo account password) and never runs migrations.
- Walkthrough documents (English and pt-BR) explain the decisions.

## Capabilities

### New Capabilities
- `demo`: what the demonstration must show and the safety rules of the runner.

### Modified Capabilities

(none)

## Impact

- New files under `e2e/demo/`, `scripts/demo.sh`, `docs/DEMO.md`; no change to `backend/` or `frontend/` runtime code.
- Writes a few chat messages and one ended alert to the development database per run; the password-recovery step changes a demo password and restores it.
- Out of scope: the final README (a later item).
