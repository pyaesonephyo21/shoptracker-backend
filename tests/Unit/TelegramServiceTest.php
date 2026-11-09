<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\TelegramService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramServiceTest extends TestCase
{
    public function test_get_file_returns_null_when_bot_token_is_not_configured(): void
    {
        Config::set('services.telegram.bot_token', null);

        $service = new TelegramService;
        $result = $service->getFile('test-file-id');

        $this->assertNull($result);
    }

    public function test_get_file_returns_result_array_on_success(): void
    {
        Config::set('services.telegram.bot_token', 'mock-bot-token');

        Http::fake([
            'https://api.telegram.org/botmock-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => [
                    'file_id' => 'test-file-id',
                    'file_unique_id' => 'unique-123',
                    'file_size' => 12345,
                    'file_path' => 'photos/order_shot.jpg',
                ],
            ], 200),
        ]);

        $service = new TelegramService;
        $result = $service->getFile('test-file-id');

        $this->assertNotNull($result);
        $this->assertSame('photos/order_shot.jpg', $result['file_path']);
    }

    public function test_download_file_downloads_binary_content_and_resolves_mime_type(): void
    {
        Config::set('services.telegram.bot_token', 'mock-bot-token');

        Http::fake([
            'https://api.telegram.org/botmock-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => [
                    'file_path' => 'photos/order_screenshot.png',
                ],
            ], 200),
            'https://api.telegram.org/file/botmock-bot-token/photos/order_screenshot.png' => Http::response('binary-image-data', 200),
        ]);

        $service = new TelegramService;
        $downloaded = $service->downloadFile('test-file-id');

        $this->assertNotNull($downloaded);
        $this->assertSame('binary-image-data', $downloaded['content']);
        $this->assertSame('image/png', $downloaded['mime_type']);
        $this->assertSame('photos/order_screenshot.png', $downloaded['file_path']);
    }

    public function test_send_message_dispatches_http_request(): void
    {
        Config::set('services.telegram.bot_token', 'mock-bot-token');

        Http::fake([
            'https://api.telegram.org/botmock-bot-token/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 999],
            ], 200),
        ]);

        $service = new TelegramService;
        $response = $service->sendMessage('-100123456789', '<b>Hello!</b>', 42);

        $this->assertTrue($response['ok']);
        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.telegram.org/botmock-bot-token/sendMessage'
                && $request['chat_id'] === '-100123456789'
                && $request['text'] === '<b>Hello!</b>'
                && $request['reply_to_message_id'] === 42
                && $request['allow_sending_without_reply'] === true
                && $request['parse_mode'] === 'HTML';
        });
    }

    public function test_send_message_retries_without_parse_mode_on_entity_error(): void
    {
        Config::set('services.telegram.bot_token', 'mock-bot-token');

        Http::fake([
            'https://api.telegram.org/botmock-bot-token/sendMessage' => Http::sequence()
                ->push(['ok' => false, 'error_code' => 400, 'description' => "Bad Request: can't parse entities in message"], 400)
                ->push(['ok' => true, 'result' => ['message_id' => 1000]], 200),
        ]);

        $service = new TelegramService;
        $response = $service->sendMessage('-100123456789', 'Unclosed <b> tag', 42);

        $this->assertTrue($response['ok']);
        Http::assertSentCount(2);
    }

    public function test_send_message_returns_error_when_bot_token_is_missing(): void
    {
        Config::set('services.telegram.bot_token', null);

        $service = new TelegramService;
        $response = $service->sendMessage('-100123456789', 'Hello');

        $this->assertFalse($response['ok']);
        $this->assertSame('Bot token not configured', $response['description']);
    }
}
