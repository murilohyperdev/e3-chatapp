#!/usr/bin/env bash
# Runs the whole automated suite: backend tests, frontend tests, lint and type-check.
#
#   docker compose up -d      # the stack must be running (PostgreSQL included)
#   ./scripts/test.sh
#
# Every stage runs even when an earlier one fails, so one run shows everything that
# is broken. The exit status is non-zero if any stage failed.
#
# Safety: the backend stage is `php artisan test`, which uses the separate e3chat_test
# database (see backend/phpunit.xml). This script never runs migrate/migrate:fresh,
# so it cannot touch the development database.

set -u
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

echo
echo "==== Summary ===="
status=0
for i in "${!names[@]}"; do
  printf '%-4s  %s\n' "${results[$i]}" "${names[$i]}"
  [ "${results[$i]}" = "PASS" ] || status=1
done
exit $status
