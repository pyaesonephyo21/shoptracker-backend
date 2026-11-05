<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\AiAddressParserService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAddressParserServiceTest extends TestCase
{
    public function test_service_returns_no_api_key_when_unconfigured(): void
    {
        Config::set('services.gemini.api_key', null);
        Config::set('services.openrouter.api_key', null);

        $service = new AiAddressParserService();
        $result = $service->parse('မအိမ့်မှူးခင် 09772775937 ရန်ကုန်');

        $this->assertFalse($result['success']);
        $this->assertSame('no_api_key', $result['reason']);
    }

    public function test_service_returns_empty_input_when_both_text_and_image_are_empty(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        $service = new AiAddressParserService();
        $result = $service->parse('   ', null);

        $this->assertFalse($result['success']);
        $this->assertSame('empty_input', $result['reason']);
    }

    public function test_service_parses_multimodal_image_with_gemini(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မအိမ့်မှူးခင်',
                                    'customer_phone' => '09772775937',
                                    'address' => 'ရန်ကုန်၊ သာကေတ',
                                    'delivery_notes' => 'ရုံးချိန်အတွင်းပို့ပါ',
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService();
        $fakeBase64 = base64_encode('fake-image-bytes');
        $result = $service->parse('', $fakeBase64, 'image/png');

        $this->assertTrue($result['success']);
        $this->assertSame('မအိမ့်မှူးခင်', $result['data']['customer_name']);
        $this->assertSame('09772775937', $result['data']['customer_phone']);
        $this->assertSame('ရန်ကုန်၊ သာကေတ', $result['data']['delivery_address']);
        $this->assertSame('ရုံးချိန်အတွင်းပို့ပါ', $result['data']['delivery_notes']);

        Http::assertSent(function ($request) {
            $parts = $request->data()['contents'][0]['parts'];
            return isset($parts[0]['inlineData'])
                && $parts[0]['inlineData']['mimeType'] === 'image/png';
        });
    }

    public function test_service_falls_back_to_gemini_35_flash_lite_on_primary_timeout(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => function () {
                throw new ConnectionException('cURL error 28: Operation timed out after 12000 milliseconds');
            },
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကိုမောင်မောင်',
                                    'customer_phone' => '09123456789',
                                    'address' => 'မန္တလေး',
                                    'delivery_notes' => '',
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService();
        $result = $service->parse('ကိုမောင်မောင် 09123456789 မန္တလေး');

        $this->assertTrue($result['success']);
        $this->assertSame('ကိုမောင်မောင်', $result['data']['customer_name']);
        $this->assertSame('09123456789', $result['data']['customer_phone']);
        $this->assertSame('မန္တလေး', $result['data']['delivery_address']);
    }

    public function test_service_falls_back_to_openrouter_when_all_gemini_fail(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');
        Config::set('services.openrouter.api_key', 'test-openrouter-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => function () {
                throw new ConnectionException('cURL error 28: Operation timed out');
            },
            'https://openrouter.ai/*' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'customer_name' => 'ဒေါ်အေးအေး',
                                'customer_phone' => '09987654321',
                                'address' => 'နေပြည်တော်',
                                'delivery_notes' => 'ဂိတ်ချိန်းပါ',
                            ]),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService();
        $result = $service->parse('ဒေါ်အေးအေး 09987654321 နေပြည်တော်');

        $this->assertTrue($result['success']);
        $this->assertSame('ဒေါ်အေးအေး', $result['data']['customer_name']);
        $this->assertSame('09987654321', $result['data']['customer_phone']);
        $this->assertSame('နေပြည်တော်', $result['data']['delivery_address']);
        $this->assertSame('ဂိတ်ချိန်းပါ', $result['data']['delivery_notes']);
    }
}

