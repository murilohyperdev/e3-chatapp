## 1. Runner

- [x] 1.1 Create `e2e/demo/demo.ts` with pacing, caption overlay, two side-by-side sessions and optional video recording
- [x] 1.2 Implement the seven scenarios in order, reusing `e2e/support/helpers.ts`, with safe reset and restore
- [x] 1.3 Add `demo` npm script in `e2e/` and `scripts/demo.sh` (checks the stack, flags `--record`, `--headless`, `--slow`); ignore `e2e/recordings/`

## 2. Script and docs

- [x] 2.1 Write `docs/DEMO.md` (pre-flight, seven scenarios, troubleshooting, answers to likely questions)
- [x] 2.2 Update `docs/WALKTHROUGH.md` and `docs/WALKTHROUGH.pt-BR.md` with the item 8 decisions

## 3. Verify

- [x] 3.1 Run the demo twice headless with recording and confirm both pass and videos exist
- [x] 3.2 Run `./scripts/test.sh --e2e` to confirm nothing regressed
