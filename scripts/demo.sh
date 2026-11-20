#!/usr/bin/env bash
# Guided demonstration of the exercise's item 8 (two sessions: administrator and user).
#
#   docker compose up -d
#   ./scripts/demo.sh                    # two browser windows side by side
#   ./scripts/demo.sh --record           # also save e2e/recordings/admin.webm and user.webm
#   ./scripts/demo.sh --headless --record  # no windows (CI, servers, rehearsal)
#   ./scripts/demo.sh --slow 2           # pauses twice as long
#
# Safe for the development stack: it never runs migrate/migrate:fresh. It writes a few chat
# messages, ends the alerts it starts, and restores the password it changes.
set -eu

export DEMO_HEADLESS=0 DEMO_RECORD=0 DEMO_SLOW=1
while [ $# -gt 0 ]; do
  case "$1" in
    --headless) DEMO_HEADLESS=1 ;;
    --record) DEMO_RECORD=1 ;;
    --slow) shift; DEMO_SLOW="${1:?--slow needs a number}" ;;
    *) echo "Unknown option: $1 (supported: --headless --record --slow N)" >&2; exit 2 ;;
  esac
  shift
done

cd "$(dirname "$0")/.."
for service in backend frontend reverb mailpit; do
  if [ -z "$(docker compose ps --status running --services "$service" 2>/dev/null | grep -x "$service")" ]; then
    echo "The '$service' service is not running. Start the stack first: docker compose up -d" >&2
    exit 2
  fi
done
if [ ! -d e2e/node_modules ]; then
  echo "e2e/node_modules is missing. Run: cd e2e && npm ci && npx playwright install chromium" >&2
  exit 2
fi

cd e2e && exec npm run --silent demo
