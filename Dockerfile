FROM php:8.2-fpm

# 1. Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

# 2. Clear cache to keep image small
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. Install PHP extensions required by Laravel
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# 4. Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 5. Set working directory
WORKDIR /var/www

# 6. Copy existing application directory contents
COPY . /var/www

# 7. Fix permissions for Laravel
RUN chown -R www-data:www-data /var/www
