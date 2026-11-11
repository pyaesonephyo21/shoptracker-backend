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

        $service = new AiAddressParserService;
        $result = $service->parse('မအိမ့်မှူးခင် 09772775937 ရန်ကုန်');

        $this->assertFalse($result['success']);
        $this->assertSame('no_api_key', $result['reason']);
    }

    public function test_service_returns_empty_input_when_both_text_and_image_are_empty(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        $service = new AiAddressParserService;
        $result = $service->parse('   ', null);

        $this->assertFalse($result['success']);
        $this->assertSame('empty_input', $result['reason']);
    }

    public function test_service_parses_multimodal_image_with_gemini(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မအိမ့်မှူးခင်',
                                    'customer_phone' => '09772775937',
                                    'address' => 'ရန်ကုန်၊ သာကေတ',
                                    'delivery_notes' => "ရုံးချိန်အတွင်းပို့ပါ\n4000 remains",
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $fakeBase64 = base64_encode('fake-image-bytes');
        $result = $service->parse('', $fakeBase64, 'image/png');

        $this->assertTrue($result['success']);
        $this->assertSame('မအိမ့်မှူးခင်', $result['data']['customer_name']);
        $this->assertSame('09772775937', $result['data']['customer_phone']);
        $this->assertSame('ရန်ကုန်၊ သာကေတ (ရုံးချိန်အတွင်းပို့ပါ)', $result['data']['delivery_address']);
        $this->assertSame('4000 remains', $result['data']['delivery_notes']);

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
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent*' => function () {
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

        $service = new AiAddressParserService;
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

        $service = new AiAddressParserService;
        $result = $service->parse('ဒေါ်အေးအေး 09987654321 နေပြည်တော်');

        $this->assertTrue($result['success']);
        $this->assertSame('ဒေါ်အေးအေး', $result['data']['customer_name']);
        $this->assertSame('09987654321', $result['data']['customer_phone']);
        $this->assertSame('နေပြည်တော် (ဂိတ်ချိန်းပါ)', $result['data']['delivery_address']);
        $this->assertSame('', $result['data']['delivery_notes']);
    }

    public function test_service_appends_secondary_phones_and_rider_instructions_to_address_in_parentheses(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'ကြယ်စင်မိုးဦး',
                                    'customer_phone' => '09266712266, 09776573573',
                                    'address' => 'အမှတ် ၈၊ ဦးလွန်းလမ်း၊ အရိုးကုန်း ရပ်ကွက်၊ တာမွေ',
                                    'delivery_notes' => "မပို့ခင်ဖုန်းဆက်ပါ\nadd after 2 weeks\n4000 remains\nမင်မင် deli လေးအပ်ပေးလိုက်ပါမယ်နော်",
                                    'paid_amount' => 12000,
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AiAddressParserService;
        $result = $service->parse('ကြယ်စင်မိုးဦး 09266712266');

        $this->assertTrue($result['success']);
        $this->assertSame('ကြယ်စင်မိုးဦး', $result['data']['customer_name']);
        $this->assertSame('09266712266', $result['data']['customer_phone']);
        $this->assertSame('အမှတ် ၈၊ ဦးလွန်းလမ်း၊ အရိုးကုန်း ရပ်ကွက်၊ တာမွေ (09776573573) (မပို့ခင်ဖုန်းဆက်ပါ)', $result['data']['delivery_address']);
        $this->assertSame('add after 2 weeks, 4000 remains', $result['data']['delivery_notes']);
        $this->assertSame(12000.0, $result['data']['paid_amount']);
    }

    public function test_format_address_and_notes_normalizes_delimiters_and_spacing(): void
    {
        $service = new AiAddressParserService;

        // Burmese address uses Myanmar comma (၊ )
        $formattedBurmese = $service->formatAddressAndNotes(
            '09402419805, 09776573573',
            'ရန်ကုန်, မြောက်ဥက္ကလာပ, ဘုမ္မာ ၁၃ လမ်း,',
            "မပို့ခင်ဖုန်းဆက်ပါ\nကျန်ငွေ ၄၀၀၀"
        );

        $this->assertSame('09402419805', $formattedBurmese['customer_phone']);
        $this->assertSame('ရန်ကုန်၊ မြောက်ဥက္ကလာပ၊ ဘုမ္မာ ၁၃ လမ်း (09776573573) (မပို့ခင်ဖုန်းဆက်ပါ)', $formattedBurmese['address']);
        $this->assertSame('ကျန်ငွေ ၄၀၀၀', $formattedBurmese['delivery_notes']);

        // Fixes OCR typo (ခညလမ်း -> ခ ၃ လမ်း) and enforces Myanmar comma (၊ )
        $formattedTypo = $service->formatAddressAndNotes(
            '09123456789',
            'ရန်ကုန်, အင်းစိန်, ခညလမ်း, အမှတ် ၄၆',
            ''
        );
        $this->assertSame('ရန်ကုန်၊ အင်းစိန်၊ ခ ၃ လမ်း၊ အမှတ် ၄၆', $formattedTypo['address']);

        // English address uses English comma (, )
        $formattedEnglish = $service->formatAddressAndNotes(
            '09123456789',
            'No. 46, Kha 3rd Street, Insein, Yangon',
            'call before deliver'
        );
        $this->assertSame('No. 46, Kha 3rd Street, Insein, Yangon (call before deliver)', $formattedEnglish['address']);
    }

    public function test_resolve_mandalay_township_for_grid_addresses(): void
    {
        $service = new AiAddressParserService;

        // User examples: 55x24 and 42x25 -> Aungmyethazan
        $this->assertSame('မန္တလေး၊ အောင်မြေသာစံ၊ 55x24', $service->resolveMandalayTownship('မန္တလေး 55x24'));
        $this->assertSame('မန္တလေး၊ အောင်မြေသာစံ၊ 42x25 လမ်း', $service->resolveMandalayTownship('မန္တလေး၊ 42x25 လမ်း'));
        $this->assertSame('မန္တလေး၊ အောင်မြေသာစံ၊ ၅၅ x ၂၄ လမ်း', $service->resolveMandalayTownship('မန္တလေး ၅၅ x ၂၄ လမ်း'));

        // Chanayethazan (27..35)
        $this->assertSame('မန္တလေး၊ ချမ်းအေးသာစံ၊ 78 x 30 လမ်း', $service->resolveMandalayTownship('78 x 30 လမ်း၊ မန္တလေး'));
        $this->assertSame('မန္တလေး၊ ချမ်းအေးသာစံ၊ ၃၀ x ၇၃ လမ်း', $service->resolveMandalayTownship('မန္တလေး ၃၀ x ၇၃ လမ်း'));

        // Mahaaungmye (36..42)
        $this->assertSame('မန္တလေး၊ မဟာအောင်မြေ၊ 84 x 38 ကြား', $service->resolveMandalayTownship('မန္တလေး 84 x 38 ကြား'));

        // Chanmyathazi (43..73)
        $this->assertSame('မန္တလေး၊ ချမ်းမြသာစည်၊ 58 x 73 လမ်း', $service->resolveMandalayTownship('မန္တလေး 58 x 73 လမ်း'));

        // Pyigyidagun (74+)
        $this->assertSame('မန္တလေး၊ ပြည်ကြီးတံခွန်၊ 110 x 62 လမ်း', $service->resolveMandalayTownship('မန္တလေး 110 x 62 လမ်း'));

        // Already has township -> left unchanged
        $this->assertSame('မန္တလေး၊ အောင်မြေသာစံ၊ ၅၅ x ၂၄ လမ်း', $service->resolveMandalayTownship('မန္တလေး၊ အောင်မြေသာစံ၊ ၅၅ x ၂၄ လမ်း'));

        // Non-Mandalay address -> left unchanged
        $this->assertSame('ရန်ကုန်၊ မြောက်ဥက္ကလာပ၊ ဘုမ္မာ ၁၃ လမ်း', $service->resolveMandalayTownship('ရန်ကုန်၊ မြောက်ဥက္ကလာပ၊ ဘုမ္မာ ၁၃ လမ်း'));
    }
}
