<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Shop;
use App\Services\TelegramService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class SetupTelegramShopCommand extends Command
{
    protected $signature = 'telegram:setup
                            {shop? : Shop ID (defaults to first shop)}
                            {--token= : Telegram Bot Token from @BotFather}
                            {--chat-id= : Telegram Group or Channel Chat ID}
                            {--register : Immediately call setWebhook to register with Telegram}';

    protected $description = 'Configure Telegram bot token and chat ID for a shop, with optional webhook registration.';

    public function handle(TelegramService $telegramService): int
    {
        $shopId = $this->argument('shop');
        $shop = $shopId ? Shop::find($shopId) : Shop::first();

        if (! $shop) {
            $this->error('No shop found.');

            return self::FAILURE;
        }

        $this->info("Configuring Telegram for Shop #{$shop->id} ({$shop->name})");

        $token = $this->option('token');
        $chatId = $this->option('chat-id');

        $updates = [];
        if ($token !== null) {
            $updates['telegram_bot_token'] = trim($token);
        }
        if ($chatId !== null) {
            $updates['telegram_chat_id'] = trim($chatId);
        }

        if (empty($shop->telegram_webhook_secret)) {
            $updates['telegram_webhook_secret'] = Str::random(32);
        }

        if (! empty($updates)) {
            $shop->update($updates);
            $this->info('Shop Telegram settings saved to database.');
        }

        $appUrl = rtrim((string) config('app.url', 'http://localhost:8088'), '/');
        $webhookUrl = "{$appUrl}/api/telegram/webhook/{$shop->telegram_webhook_secret}";

        $this->table(['Key', 'Value'], [
            ['Shop ID', (string) $shop->id],
            ['Bot Token', $shop->telegram_bot_token ? Str::mask($shop->telegram_bot_token, '*', 8, -6) : '<not set>'],
            ['Chat ID', $shop->telegram_chat_id ?: '<not set>'],
            ['Webhook URL', $webhookUrl],
        ]);

        if ($this->option('register')) {
            if (empty($shop->telegram_bot_token)) {
                $this->error('Cannot register webhook: Bot token is not set.');

                return self::FAILURE;
            }

            $this->info("Registering webhook with Telegram API: {$webhookUrl}");
            $result = $telegramService->setWebhook(
                $webhookUrl,
                $shop->telegram_bot_token,
                $shop->telegram_webhook_secret
            );

            if (($result['ok'] ?? false) === true) {
                $this->info('Webhook successfully registered with Telegram!');
            } else {
                $desc = $result['description'] ?? 'Unknown error';
                $this->error("Failed to register webhook: {$desc}");

                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }
}
