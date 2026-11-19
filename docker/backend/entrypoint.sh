#!/bin/sh
# Makes `docker compose up` work on a fresh clone with no manual steps.
set -e

[ -f .env ] || cp .env.example .env

if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

# Generate APP_KEY only when it is still empty.
if ! grep -qE '^APP_KEY=.+' .env; then
    php artisan key:generate --ansi
fi

exec "$@"
