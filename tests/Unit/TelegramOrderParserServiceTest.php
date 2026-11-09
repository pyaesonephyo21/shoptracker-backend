<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\AiAddressParserService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramOrderParserServiceTest extends TestCase
{
    public function test_returns_no_api_key_when_unconfigured(): void
    {
        Config::set('services.gemini.api_key', null);
        Config::set('services.openrouter.api_key', null);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Infinity Silver 1', 'fake-base64', 'image/jpeg', []);

        $this->assertFalse($result['success']);
        $this->assertSame('no_api_key', $result['reason']);
    }

    public function test_parses_multimodal_order_and_matches_variant_with_gemini_38(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        $candidates = [
            [
                'id' => 101,
                'product_name' => 'Infinity Necklace',
                'variant_sku' => 'INF-SLV',
                'attributes' => ['Color' => 'Silver'],
                'price' => 35000,
                'stock_quantity' => 5,
            ],
            [
                'id' => 102,
                'product_name' => 'Infinity Necklace',
                'variant_sku' => 'INF-GLD',
                'attributes' => ['Color' => 'Gold'],
                'price' => 38000,
                'stock_quantity' => 2,
            ],
        ];

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ဒေါ်နွယ်နွယ်ဝင်း',
                                    'customer_phone' => '09772775937',
                                    'delivery_address' => 'အမှတ် ၁၁ ရပ်ကွက်၊ သာကေတမြို့နယ်၊ ရန်ကုန်',
                                    'delivery_notes' => 'ရုံးချိန်အတွင်းပို့ပါ',
                                    'items' => [
                                        [
                                            'product_variant_id' => 101,
                                            'quantity' => 1,
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Infinity Silver 1', base64_encode('image-bytes'), 'image/jpeg', $candidates);

        $this->assertTrue($result['success']);
        $this->assertSame('ဒေါ်နွယ်နွယ်ဝင်း', $result['data']['customer_name']);
        $this->assertSame('09772775937', $result['data']['customer_phone']);
        $this->assertSame('အမှတ် ၁၁ ရပ်ကွက်၊ သာကေတမြို့နယ်၊ ရန်ကုန်', $result['data']['delivery_address']);
        $this->assertSame('ရုံးချိန်အတွင်းပို့ပါ', $result['data']['delivery_notes']);
        $this->assertCount(1, $result['data']['items']);
        $this->assertSame(101, $result['data']['items'][0]['product_variant_id']);
        $this->assertSame(1, $result['data']['items'][0]['quantity']);

        Http::assertSent(function ($request) {
            $parts = $request->data()['contents'][0]['parts'];

            return isset($parts[0]['inlineData'])
                && $parts[0]['inlineData']['mimeType'] === 'image/jpeg'
                && str_contains($parts[1]['text'], 'Infinity Silver 1');
        });
    }

    public function test_normalizes_burmese_digits_in_phone_number(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကိုအောင်ကျော်',
                                    'customer_phone' => '၀၉၄၂၀၀၁၁၂၂၃',
                                    'delivery_address' => 'မန္တလေး',
                                    'delivery_notes' => '',
                                    'items' => [
                                        [
                                            'product_variant_id' => 1,
                                            'quantity' => 2,
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Item 2', base64_encode('bytes'), 'image/png', []);

        $this->assertTrue($result['success']);
        $this->assertSame('09420011223', $result['data']['customer_phone']);
    }

    public function test_falls_back_to_gemini_35_flash_lite_on_primary_model_failure(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => function () {
                throw new ConnectionException('Operation timed out');
            },
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မစန္ဒာ',
                                    'customer_phone' => '09987654321',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'delivery_notes' => '',
                                    'items' => [
                                        [
                                            'product_variant_id' => 5,
                                            'quantity' => 1,
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Variant 5', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame('မစန္ဒာ', $result['data']['customer_name']);
        $this->assertSame(5, $result['data']['items'][0]['product_variant_id']);
    }

    public function test_falls_back_to_openrouter_when_all_gemini_fail(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');
        Config::set('services.openrouter.api_key', 'test-openrouter-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(['error' => 'quota exceeded'], 429),
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'customer_name' => 'မအေးအေး',
                                'customer_phone' => '09112233445',
                                'delivery_address' => 'နေပြည်တော်',
                                'delivery_notes' => '',
                                'items' => [
                                    ['product_variant_id' => 10, 'quantity' => 1],
                                ],
                            ]),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Product 10', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame('မအေးအေး', $result['data']['customer_name']);
        $this->assertSame(10, $result['data']['items'][0]['product_variant_id']);
    }

    public function test_normalizes_burmese_digits_in_quantity(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ဒေါ်ခင်ခင်',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'items' => [
                                        [
                                            'product_variant_id' => '၁၀၁',
                                            'quantity' => '၂', // Burmese numeral 2
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Necklace 2', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(101, $result['data']['items'][0]['product_variant_id']);
        $this->assertSame(2, $result['data']['items'][0]['quantity']);
    }

    public function test_extracts_json_when_surrounded_by_conversational_text_or_markdown(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        $conversationalOutput = <<<'TEXT'
Sure! Here is the extracted customer order:
```json
{
  "customer_name": "ကိုမောင်မောင်",
  "customer_phone": "09123456789",
  "delivery_address": "မန္တလေး",
  "delivery_notes": "မနက်ပို့ပါ",
  "items": [
    {
      "product_variant_id": 42,
      "quantity": 3
    }
  ]
}
```
Please let me know if you need anything else!
TEXT;

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => $conversationalOutput],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Product 42', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame('ကိုမောင်မောင်', $result['data']['customer_name']);
        $this->assertSame('မနက်ပို့ပါ', $result['data']['delivery_notes']);
        $this->assertSame(42, $result['data']['items'][0]['product_variant_id']);
        $this->assertSame(3, $result['data']['items'][0]['quantity']);
    }

    public function test_includes_safety_settings_in_gemini_request(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'Name',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'Address',
                                    'items' => [],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $service->parseOrder('Test', base64_encode('bytes'), 'image/jpeg', []);

        Http::assertSent(function ($request) {
            $data = $request->data();

            return isset($data['safetySettings'])
                && count($data['safetySettings']) === 4
                && $data['safetySettings'][0]['threshold'] === 'BLOCK_NONE';
        });
    }

    public function test_extracts_paid_amount_from_ai_json_response(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မသီတာ',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'paid_amount' => 12000,
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1 prepaid - 12000', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_normalizes_burmese_digits_in_paid_amount_from_ai(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မသီတာ',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'paid_amount' => '၁၂၀၀၀',
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_fallback_regex_extracts_prepaid_amount_when_ai_omits_or_returns_zero(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကိုမင်းမင်း',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'မန္တလေး',
                                    'paid_amount' => 0,
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1 prepaid - 12000', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_fallback_regex_extracts_burmese_digits_in_caption(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကိုမင်းမင်း',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'မန္တလေး',
                                    'paid_amount' => 0,
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1 prepaid - ၁၂၀၀၀', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_extract_prepaid_amount_helper_formats(): void
    {
        $service = new AiAddressParserService;

        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid - 12000'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid: 12000'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid 12000'));
        $this->assertSame(15000.0, $service->extractPrepaidAmount('Silver 1 paid 15000'));
        $this->assertSame(5000.0, $service->extractPrepaidAmount('Silver 1 deposit 5000'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid - ၁၂၀၀၀'));
        $this->assertSame(5000.0, $service->extractPrepaidAmount('Silver 1 စရန် ၅၀၀၀'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 ကြိုလွှဲ ၁၂၀၀၀'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid - 12,000 MMK'));
        $this->assertSame(0.0, $service->extractPrepaidAmount('Silver 1 without any prepaid notes'));

        // Amount before keyword
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1, 12000 prepaid'));
        $this->assertSame(15000.0, $service->extractPrepaidAmount('Silver 1 15000 paid'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1, 12000 စရန်'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 စရန်ငွေ 12000'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1, 12000 စရန်ငွေ'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1, ၁၂၀၀၀ စရန်ငွေ'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 12000 ကြိုရှင်း'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 ငွေကြိုလွှဲ 12000'));

        // Shorthand 'k' notation
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid 12k'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 12k prepaid'));
        $this->assertSame(12500.0, $service->extractPrepaidAmount('Silver 1 prepaid 12.5k'));
        $this->assertSame(12500.0, $service->extractPrepaidAmount('Silver 1 12.5k prepaid'));
        $this->assertSame(50000.0, $service->extractPrepaidAmount('Silver 1 deposit 50k'));

        // Units and currency combinations
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 prepaid 12,000 ks'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 12000ks prepaid'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 12000 ကျပ် prepaid'));
        $this->assertSame(12000.0, $service->extractPrepaidAmount('Silver 1 ၁၂၀၀၀ ကျပ် စရန်'));

        // Multi-number captions: quantity + size + prepaid
        $this->assertSame(15000.0, $service->extractPrepaidAmount('Dress 2 size 38 prepaid - 15000'));
        $this->assertSame(15000.0, $service->extractPrepaidAmount('Dress 2 size 38, 15000 prepaid'));
    }

    public function test_filters_prepaid_notes_while_preserving_legitimate_delivery_instructions(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ဒေါ်နွယ်',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'delivery_notes' => "prepaid - 12000\nမနက်ပိုင်းပို့ပါ",
                                    'paid_amount' => 12000,
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1 prepaid - 12000', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame('မနက်ပိုင်းပို့ပါ', $result['data']['delivery_notes']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_handles_k_shorthand_in_ai_paid_amount(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကိုအောင်',
                                    'customer_phone' => '09123456789',
                                    'delivery_address' => 'မန္တလေး',
                                    'paid_amount' => '12.5k',
                                    'items' => [
                                        ['product_variant_id' => 1, 'quantity' => 1],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parseOrder('Silver 1', base64_encode('bytes'), 'image/jpeg', []);

        $this->assertTrue($result['success']);
        $this->assertSame(12500.0, $result['data']['paid_amount']);
    }
}
