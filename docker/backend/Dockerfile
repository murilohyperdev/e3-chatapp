# Development image for the Laravel API.
FROM php:8.4-cli

# System libraries needed to compile the PHP extensions below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libpng-dev libjpeg-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    # pdo_pgsql: PostgreSQL driver | pcntl: needed later by the WebSocket server
    # gd: image handling for profile pictures | zip: composer dist installs
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pcntl gd zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Run as a user matching the host UID/GID so files created in the bind-mounted
# source tree (vendor/, storage/, ...) are not owned by root.
ARG UID=1000
ARG GID=1000
RUN groupadd -g "$GID" app 2>/dev/null || true \
    && useradd -m -u "$UID" -g "$GID" app 2>/dev/null || true

COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER ${UID}
WORKDIR /var/www/html
ENTRYPOINT ["entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
