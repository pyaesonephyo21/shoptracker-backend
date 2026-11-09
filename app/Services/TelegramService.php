<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramService
{
    /**
     * @return array<string, mixed>|null
     */
    public function getFile(string $fileId, ?string $botToken = null): ?array
    {
        $token = $this->resolveToken($botToken);
        if (empty($token)) {
            Log::error('Telegram Bot Token is not configured.');

            return null;
        }

        try {
            $response = Http::connectTimeout(5)->timeout(15)
                ->get("https://api.telegram.org/bot{$token}/getFile", [
                    'file_id' => $fileId,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                if (($data['ok'] ?? false) === true && isset($data['result']['file_path'])) {
                    return $data['result'];
                }
            }

            Log::warning('Telegram getFile failed', ['response' => $response->body()]);

            return null;
        } catch (Throwable $e) {
            Log::error('Telegram getFile exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array{content: string, mime_type: string, file_path: string}|null
     */
    public function downloadFile(string $fileId, ?string $botToken = null): ?array
    {
        $fileInfo = $this->getFile($fileId, $botToken);
        if (! $fileInfo || empty($fileInfo['file_path'])) {
            return null;
        }

        $token = $this->resolveToken($botToken);
        $filePath = (string) $fileInfo['file_path'];

        try {
            $response = Http::connectTimeout(5)->timeout(30)
                ->get("https://api.telegram.org/file/bot{$token}/{$filePath}");

            if ($response->successful()) {
                $content = $response->body();
                $mimeType = $this->resolveMimeType($filePath);

                return [
                    'content' => $content,
                    'mime_type' => $mimeType,
                    'file_path' => $filePath,
                ];
            }

            Log::warning('Telegram file download failed', ['status' => $response->status()]);

            return null;
        } catch (Throwable $e) {
            Log::error('Telegram file download exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function sendMessage(
        int|string $chatId,
        string $text,
        ?int $replyToMessageId = null,
        string $parseMode = 'HTML',
        ?string $botToken = null
    ): array {
        $token = $this->resolveToken($botToken);
        if (empty($token)) {
            Log::error('Telegram Bot Token is not configured for sending message.');

            return ['ok' => false, 'description' => 'Bot token not configured'];
        }

        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => $parseMode,
        ];

        if ($replyToMessageId !== null) {
            $payload['reply_to_message_id'] = $replyToMessageId;
            $payload['allow_sending_without_reply'] = true;
        }

        try {
            $response = Http::connectTimeout(5)->timeout(15)
                ->post("https://api.telegram.org/bot{$token}/sendMessage", $payload);

            $data = $response->json();

            // If HTML entity parsing fails, retry once as plain text
            if (! $response->successful() && is_array($data) && str_contains((string) ($data['description'] ?? ''), "can't parse entities")) {
                unset($payload['parse_mode']);
                $fallbackResponse = Http::connectTimeout(5)->timeout(15)
                    ->post("https://api.telegram.org/bot{$token}/sendMessage", $payload);

                $fallbackData = $fallbackResponse->json();

                return is_array($fallbackData) ? $fallbackData : ['ok' => $fallbackResponse->successful()];
            }

            return is_array($data) ? $data : ['ok' => $response->successful()];
        } catch (Throwable $e) {
            Log::error('Telegram sendMessage exception: '.$e->getMessage());

            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getMe(?string $botToken = null): array
    {
        $token = $this->resolveToken($botToken);
        if (empty($token)) {
            return ['ok' => false, 'description' => 'Bot token not configured'];
        }

        try {
            $response = Http::connectTimeout(5)->timeout(10)
                ->get("https://api.telegram.org/bot{$token}/getMe");

            return $response->json() ?: ['ok' => $response->successful()];
        } catch (Throwable $e) {
            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function setWebhook(string $url, ?string $botToken = null, ?string $secretToken = null): array
    {
        $token = $this->resolveToken($botToken);
        if (empty($token)) {
            return ['ok' => false, 'description' => 'Bot token not configured'];
        }

        $params = ['url' => $url];
        if (! empty($secretToken)) {
            $params['secret_token'] = $secretToken;
        }

        try {
            $response = Http::connectTimeout(5)->timeout(15)
                ->post("https://api.telegram.org/bot{$token}/setWebhook", $params);

            return $response->json() ?: ['ok' => $response->successful()];
        } catch (Throwable $e) {
            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }

    private function resolveToken(?string $botToken): string
    {
        return $botToken ?: (string) config('services.telegram.bot_token', '');
    }

    private function resolveMimeType(string $filePath): string
    {
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        return match ($extension) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'image/jpeg',
        };
    }
}
