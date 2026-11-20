#!/usr/bin/env bash
# Runs the whole automated suite: backend tests, frontend tests, lint and type-check.
#
#   docker compose up -d      # the stack must be running (PostgreSQL included)
#   ./scripts/test.sh
#   ./scripts/test.sh --e2e   # also run the browser (Playwright) tests in e2e/
#
# The end-to-end stage is opt-in: it needs a Chromium browser (`cd e2e && npm ci &&
# npx playwright install chromium`, or E2E_CHROMIUM_PATH) and it writes a few demo
# chat messages and one alert (ended again) to the development database.
#
# Every stage runs even when an earlier one fails, so one run shows everything that
# is broken. The exit status is non-zero if any stage failed.
#
# Safety: the backend stage is `php artisan test`, which uses the separate e3chat_test
# database (see backend/phpunit.xml). This script never runs migrate/migrate:fresh,
# so it cannot touch the development database.

set -u

run_e2e=0
for arg in "$@"; do
  case "$arg" in
    --e2e) run_e2e=1 ;;
    *) echo "Unknown option: $arg (supported: --e2e)" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

for service in backend frontend; do
  if [ -z "$(docker compose ps --status running --services "$service" 2>/dev/null)" ]; then
    echo "The '$service' service is not running. Start the stack first: docker compose up -d" >&2
    exit 2
  fi
done

names=()
results=()

run_stage() {
  local name=$1
  shift
  echo
  echo "==> $name"
  if "$@"; then results+=("PASS"); else results+=("FAIL"); fi
  names+=("$name")
}

run_stage "Backend tests (PHPUnit)" docker compose exec -T backend php artisan test
run_stage "Frontend tests (Vitest)" docker compose exec -T frontend npm test
run_stage "Frontend lint (oxlint)" docker compose exec -T frontend npm run lint
run_stage "Frontend type-check and build" docker compose exec -T frontend npm run build

if [ "$run_e2e" = 1 ]; then
  if [ ! -d e2e/node_modules ]; then
    echo "e2e/node_modules is missing. Run: cd e2e && npm ci && npx playwright install chromium" >&2
    names+=("End-to-end tests (Playwright)")
    results+=("FAIL")
  else
    run_stage "End-to-end tests (Playwright)" bash -c 'cd e2e && npx playwright test'
  fi
else
  names+=("End-to-end tests (Playwright), use --e2e")
  results+=("SKIP")
fi

echo
echo "==== Summary ===="
status=0
for i in "${!names[@]}"; do
  printf '%-4s  %s\n' "${results[$i]}" "${names[$i]}"
  [ "${results[$i]}" = "FAIL" ] && status=1
done
exit $status
