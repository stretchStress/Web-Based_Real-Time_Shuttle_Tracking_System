# --- Base image ---
FROM php:8.2-apache

# --- System packages & PHP extensions ---
RUN apt-get update && apt-get install -y \
    libpng-dev libonig-dev libxml2-dev zip unzip git curl sqlite3 libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite mbstring exif pcntl bcmath gd

# --- Apache setup ---
RUN a2enmod rewrite
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot ${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf && \
    echo "<Directory /var/www/html/public>\n\tAllowOverride All\n\tRequire all granted\n</Directory>" >> /etc/apache2/apache2.conf

# --- Working directory ---
WORKDIR /var/www/html

# --- Copy source code ---
COPY . .

# --- Composer setup ---
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# --- Fix permissions ---
RUN chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache

# --- Prevent DB connection errors during build ---
ENV DB_CONNECTION=mysql

# --- Optimize Laravel for production ---
# NOTE: we DO NOT run "php artisan config:cache" here, because it would bake local .env values
RUN php artisan key:generate --force || true \
    && php artisan config:clear || true \
    && php artisan cache:clear || true \
    && php artisan route:clear || true \
    && php artisan view:clear || true

# --- Expose port ---
EXPOSE 80

# --- Start server ---
CMD php artisan migrate --force || true && apache2-foreground
