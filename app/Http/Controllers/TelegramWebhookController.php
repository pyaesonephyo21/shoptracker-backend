<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\ProcessTelegramOrderJob;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    public function handle(Request $request, string $secretToken): JsonResponse
    {
        $configuredSecret = (string) config('services.telegram.webhook_secret', '');
        $isGlobalValid = ! empty($configuredSecret) && hash_equals($configuredSecret, $secretToken);
        $shopWithSecret = ! empty($secretToken)
            ? Shop::where('telegram_webhook_secret', $secretToken)->first()
            : null;

        if (! $isGlobalValid && ! $shopWithSecret) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $message = $request->input('message') ?? $request->input('channel_post');
        if (! is_array($message) || empty($message)) {
            return response()->json(['ok' => true]);
        }

        $chatId = (string) ($message['chat']['id'] ?? '');

        if ($shopWithSecret) {
            $shop = $shopWithSecret;
            if (! empty($shop->telegram_chat_id) && ! empty($chatId) && (string) $shop->telegram_chat_id !== $chatId) {
                Log::warning("Telegram webhook chat ID {$chatId} does not match configured chat ID for shop {$shop->id}");

                return response()->json(['ok' => true]);
            }
        } else {
            $shop = ! empty($chatId) ? Shop::where('telegram_chat_id', $chatId)->first() : null;
        }

        if (! $shop) {
            Log::warning("Telegram message received for unconfigured chat ID: {$chatId}");

            return response()->json(['ok' => true]);
        }

        $hasPhoto = ! empty($message['photo']);
        $hasImageDoc = ! empty($message['document']) && str_starts_with((string) ($message['document']['mime_type'] ?? ''), 'image/');
        $reply = $message['reply_to_message'] ?? null;
        $hasReplyPhoto = is_array($reply) && (! empty($reply['photo']) || (! empty($reply['document']) && str_starts_with((string) ($reply['document']['mime_type'] ?? ''), 'image/')));
        $isPrivate = ($message['chat']['type'] ?? '') === 'private';
        $isCommand = str_starts_with(trim((string) ($message['text'] ?? '')), '/');

        if (! $hasPhoto && ! $hasImageDoc && ! $hasReplyPhoto && ! $isPrivate && ! $isCommand) {
            return response()->json(['ok' => true]);
        }

        ProcessTelegramOrderJob::dispatchAfterResponse($shop->id, $message);

        return response()->json(['ok' => true]);
    }
}
