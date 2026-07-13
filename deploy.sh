#!/bin/bash
# Exit script instantly if any command fails
set -e

echo "=========================================="
echo "🚀 STARTING DEPLOYMENT PROCESS"
echo "=========================================="

# 1. Place app in maintenance mode so users see a clean downtime screen
echo "🚧 Putting app into maintenance mode..."
php artisan down --render="errors::503" || true

# 2. Pull down the latest pre-compiled code from main branch
echo "📥 Fetching latest code from Git..."
git pull origin main

# 3. Install production-only composer dependencies (Swap handles memory)
echo "📦 Installing production composer packages..."
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# 4. Check/Create the production SQLite database file
echo "🗄️ Checking SQLite database existence..."
mkdir -p database
if [ ! -f database/database.sqlite ]; then
    touch database/database.sqlite
    echo "💡 Created a fresh database.sqlite file."
fi

# 5. Clear all development cached configurations
echo "🧹 Clearing old caches..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 6. Run safe production database migrations
echo "⚙️ Running database migrations..."
php artisan migrate --force

# 7. Enable high-performance production route/config caching
echo "⚡ Generating high-speed caches..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 8. Assign secure folders ownership and read/write permissions
echo "🔒 Restoring correct storage and bootstrap permissions..."
sudo chmod -R 775 storage bootstrap/cache database
sudo chown -R www-data:www-data storage bootstrap/cache database || true

# 9. Bring application back online
echo "🟢 Bringing application online..."
php artisan up

echo "=========================================="
echo "🎉 DEPLOYMENT FINISHED SUCCESSFUL!"
echo "=========================================="
