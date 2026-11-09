<?php

declare(strict_types=1);

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Services\TelegramService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class TelegramSettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $shop = $request->user()->shop;

        if (empty($shop->telegram_webhook_secret)) {
            $shop->update([
                'telegram_webhook_secret' => Str::random(32),
            ]);
        }

        $appUrl = rtrim((string) config('app.url', 'http://localhost:8088'), '/');
        $webhookUrl = "{$appUrl}/api/telegram/webhook/{$shop->telegram_webhook_secret}";

        return Inertia::render('Management/TelegramSettings', [
            'settings' => [
                'telegram_bot_token' => $shop->telegram_bot_token ?? '',
                'telegram_chat_id' => $shop->telegram_chat_id ?? '',
                'telegram_webhook_secret' => $shop->telegram_webhook_secret ?? '',
                'webhook_url' => $webhookUrl,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $shop = $request->user()->shop;

        $validated = $request->validate([
            'telegram_bot_token' => ['nullable', 'string', 'max:255'],
            'telegram_chat_id' => ['nullable', 'string', 'max:100'],
        ]);

        if (empty($shop->telegram_webhook_secret)) {
            $validated['telegram_webhook_secret'] = Str::random(32);
        }

        $shop->update($validated);

        return back()->with('success', 'Telegram settings updated successfully.');
    }

    public function registerWebhook(Request $request, TelegramService $telegramService): RedirectResponse
    {
        $shop = $request->user()->shop;

        if (empty($shop->telegram_bot_token)) {
            return back()->with('error', 'Please configure and save your Telegram Bot Token first.');
        }

        if (empty($shop->telegram_webhook_secret)) {
            $shop->update(['telegram_webhook_secret' => Str::random(32)]);
        }

        $appUrl = rtrim((string) config('app.url', 'http://localhost:8088'), '/');
        $webhookUrl = "{$appUrl}/api/telegram/webhook/{$shop->telegram_webhook_secret}";

        $result = $telegramService->setWebhook(
            $webhookUrl,
            $shop->telegram_bot_token,
            $shop->telegram_webhook_secret
        );

        if (($result['ok'] ?? false) === true) {
            return back()->with('success', 'Telegram webhook registered successfully! Bot is now listening for orders.');
        }

        $desc = (string) ($result['description'] ?? 'Failed to register webhook with Telegram.');

        return back()->with('error', "Webhook registration failed: {$desc}");
    }

    public function testConnection(Request $request, TelegramService $telegramService): RedirectResponse
    {
        $shop = $request->user()->shop;

        if (empty($shop->telegram_bot_token)) {
            return back()->with('error', 'Please enter a Telegram Bot Token first.');
        }

        $result = $telegramService->getMe($shop->telegram_bot_token);

        if (($result['ok'] ?? false) === true && isset($result['result']['username'])) {
            $botName = $result['result']['first_name'] ?? 'Bot';
            $botUsername = $result['result']['username'];

            return back()->with('success', "Connection successful! Connected to {$botName} (@{$botUsername}).");
        }

        $desc = (string) ($result['description'] ?? 'Invalid token or unable to reach Telegram API.');

        return back()->with('error', "Connection test failed: {$desc}");
    }
}
