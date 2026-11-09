<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramOrderParserService
{
    /**
     * Parse screenshot image and order caption using Gemini 3.8 Flash multimodal model.
     *
     * @param  array<int, array<string, mixed>>  $candidateVariants
     * @return array<string, mixed>
     */
    public function parseOrder(
        string $caption,
        string $imageBase64,
        string $imageMimeType,
        array $candidateVariants
    ): array {
        $geminiKey = config('services.gemini.api_key');
        $geminiProxy = config('services.gemini.proxy');
        $geminiBaseUrl = rtrim((string) config('services.gemini.base_url', 'https://generativelanguage.googleapis.com'), '/');
        $openRouterKey = config('services.openrouter.api_key');

        if (empty($openRouterKey) && empty($geminiKey)) {
            return [
                'success' => false,
                'reason' => 'no_api_key',
                'message' => 'No AI API Key is configured on the server.',
            ];
        }

        if (preg_match('/^data:([^;]+);base64,(.+)$/', $imageBase64, $matches)) {
            $imageMimeType = $matches[1];
            $imageBase64 = $matches[2];
        }
        $imageBase64 = (string) preg_replace('/\s+/', '', $imageBase64);
        $imageMimeType = $imageMimeType ?: 'image/jpeg';

        $variantsJson = json_encode($candidateVariants, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $systemPrompt = <<<PROMPT
You are an expert AI order processing assistant for a Myanmar e-commerce shop.
You are given:
1. A screenshot of a customer chat (e.g. Facebook Messenger, Viber, Telegram), waybill, or delivery note.
2. An order caption or text written by the sales team (e.g. "Infinity Silver 1" or "Cotton T-shirt Red M 2 prepaid - 12000").
3. A JSON list of active product variants available in the shop:
{$variantsJson}

Your mission:
1. Perform OCR on the screenshot to extract the BUYER/RECIPIENT customer details:
   - customer_name: Full name of the customer. Preserve legitimate Burmese honorifics ("ကို", "မ", "ဒေါ်", "ဦး", "မောင်", "Dr."). Strip vocatives and greetings ("မင်္ဂလာပါ", "အမရေ", "Name:"). Do NOT truncate legitimate name syllables (e.g. "ခင်", "ဝင်း", "ဖြူ", "နွယ်", "မိုး", "ထွေး").
   - customer_phone: Standard Myanmar phone number. Convert Burmese digits (၀-၉) to English (0-9). Standardize to 09 format (e.g. "09XXXXXXXXX"). If multiple phones exist, separate with comma.
   - delivery_address: Complete address including city, township, street, building, ward (ရပ်ကွက် e.g. "၁၁ ရပ်ကွက်"), landmarks, express bus gate (ကားဂိတ် / အဝေးပြေးဂိတ်).
   - delivery_notes: ONLY logistics constraints (e.g., "ကျောင်းဖွင့်ရက်မှပို့ပါ", "မနက်ပိုင်းပို့ပါ", "ရုံးချိန်ပို့ပေးပါ", "ကားဂိတ်ချိန်းပါ"). NEVER put payment method (COD, KPay, etc.) or purchase intent into delivery_notes. If none, leave empty string ("").

CRITICAL OCR & BURMESE SCRIPT ACCURACY:
- Wards: Distinguish numbered wards (e.g., ၁၀, ၁၁, ၁၂, ၁၆ ရပ်ကွက်). Look closely at circular loops (e.g., '၁၁' for Ward 11, do not drop to '၁'). Also preserve alphabetical wards (e.g. 'ဘ ရပ်ကွက်', 'ဈ ရပ်ကွက်').
- Townships: Validate genuine Myanmar townships ('ဓနုဖြူ', 'ရေနံချောင်း', 'ချောက်', 'သာကေတ', 'မြောက်ဒဂုံ', 'လှိုင်သာယာ'). Disambiguate 'ဓ' (Dha) vs 'စ' (Sa) vs 'မ' (Ma) (e.g. 'ဓနုဖြူ', NOT 'စနုဖြူ').

2. Match the ordered product(s) and variant(s):
   - Read the sales team's caption and match against the provided candidate product variants list.
   - Compare product name, variant SKU, and variant attributes (e.g. color, size).
   - Extract the exact candidate "id" as "product_variant_id", and the ordered "quantity" (integer >= 1, defaults to 1).
   - If multiple products are mentioned, include each matched product in the "items" list.
   - If a product cannot be confidently matched to the candidates list, omit it from the items list.

3. Extract prepaid / advance payment amount:
   - If the caption or message specifies a prepaid, advance, or deposit amount (e.g. "prepaid - 12000", "prepaid: 12000", "12000 prepaid", "paid 15000", "deposit 5000", "prepaid 12k", "12k prepaid", or Burmese digits "prepaid - ၁၂၀၀၀", "စရန် ၅၀၀၀", "စရန်ငွေ ၁၂၀၀၀", "ကြိုလွှဲ ၁၂၀၀၀", "၁၂၀၀၀ စရန်", "ကြိုရှင်း ၁၂၀၀၀"), extract this numerical value as "paid_amount" (numeric float >= 0).
   - If the amount uses "k" shorthand (e.g. "12k", "15k", "120k"), convert to thousands (e.g. 12k -> 12000, 15k -> 15000).
   - Convert Burmese digits (၀-၉) to standard English numbers (0-9).
   - Distinguish quantities/sizes (e.g. "2" in "Dress 2" or "38" in "size 38") from payment amounts. Only extract the amount explicitly marked as prepaid/paid/deposit/advance/စရန်.
   - If no prepaid or advance payment is mentioned in the caption/text, set "paid_amount": 0.

Return ONLY a valid JSON object without markdown fences (no ```json):
{
  "customer_name": "...",
  "customer_phone": "...",
  "delivery_address": "...",
  "delivery_notes": "",
  "paid_amount": 0,
  "items": [
    {
      "product_variant_id": 1,
      "quantity": 1
    }
  ]
}
PROMPT;

        $promptText = trim($caption);
        if (empty($promptText)) {
            $promptText = 'Extract customer details from the screenshot and match ordered products from the candidates list.';
        } else {
            $promptText = "Order caption: {$promptText}\n\nExtract customer recipient details from the screenshot, and match the ordered products from the caption against the candidates list.";
        }

        try {
            $content = '';
            $source = '';

            if (! empty($geminiKey)) {
                $geminiModels = [
                    'gemini-3.8-flash',
                    'gemini-3.5-flash-lite',
                    'gemini-3.1-flash-lite',
                ];

                $userParts = [
                    [
                        'inlineData' => [
                            'mimeType' => $imageMimeType,
                            'data' => $imageBase64,
                        ],
                    ],
                    [
                        'text' => $promptText,
                    ],
                ];

                foreach ($geminiModels as $gModel) {
                    try {
                        $http = Http::connectTimeout(3)->timeout(15)
                            ->withOptions([
                                'curl' => [
                                    CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                                ],
                            ])
                            ->withHeaders([
                                'Content-Type' => 'application/json',
                            ]);

                        if (! empty($geminiProxy)) {
                            $http->withOptions(['proxy' => $geminiProxy]);
                        }

                        $geminiResponse = $http->post("{$geminiBaseUrl}/v1beta/models/{$gModel}:generateContent?key={$geminiKey}", [
                            'system_instruction' => [
                                'parts' => ['text' => $systemPrompt],
                            ],
                            'contents' => [
                                [
                                    'role' => 'user',
                                    'parts' => $userParts,
                                ],
                            ],
                            'safetySettings' => [
                                [
                                    'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                                    'threshold' => 'BLOCK_NONE',
                                ],
                                [
                                    'category' => 'HARM_CATEGORY_HARASSMENT',
                                    'threshold' => 'BLOCK_NONE',
                                ],
                                [
                                    'category' => 'HARM_CATEGORY_HATE_SPEECH',
                                    'threshold' => 'BLOCK_NONE',
                                ],
                                [
                                    'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                                    'threshold' => 'BLOCK_NONE',
                                ],
                            ],
                            'generationConfig' => [
                                'temperature' => 0.0,
                                'responseMimeType' => 'application/json',
                            ],
                        ]);

                        if ($geminiResponse->successful()) {
                            $geminiData = $geminiResponse->json();
                            $content = (string) ($geminiData['candidates'][0]['content']['parts'][0]['text'] ?? '');
                            if (! empty($content)) {
                                $source = "gemini:{$gModel}";
                                break;
                            }
                        }

                        Log::warning("Gemini model {$gModel} failed in TelegramOrderParser (status: {$geminiResponse->status()})");
                    } catch (Throwable $e) {
                        Log::warning("Gemini connection error on {$gModel} in TelegramOrderParser: ".$e->getMessage());

                        $msg = strtolower($e->getMessage());
                        if (str_contains($msg, 'could not resolve host') || str_contains($msg, 'curl error 6')) {
                            break;
                        }
                    }
                }
            }

            if (empty($content) && ! empty($openRouterKey)) {
                $primaryModel = (string) config('services.openrouter.model', 'nvidia/nemotron-3.5-super-vl:free');
                $modelChain = array_unique([
                    $primaryModel,
                    'nvidia/nemotron-3.5-super-vl:free',
                    'google/gemma-4-26b-a4b-it:free',
                ]);

                $userContent = [
                    ['type' => 'text', 'text' => $promptText],
                    [
                        'type' => 'image_url',
                        'image_url' => [
                            'url' => "data:{$imageMimeType};base64,{$imageBase64}",
                        ],
                    ],
                ];

                foreach ($modelChain as $currentModel) {
                    try {
                        $orResponse = Http::connectTimeout(3)->timeout(15)
                            ->withOptions([
                                'curl' => [
                                    CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                                ],
                            ])
                            ->withHeaders([
                                'Authorization' => "Bearer {$openRouterKey}",
                                'HTTP-Referer' => config('app.url', 'http://localhost:8088'),
                                'X-Title' => 'ShopTracker',
                                'Content-Type' => 'application/json',
                            ])
                            ->post('https://openrouter.ai/api/v1/chat/completions', [
                                'model' => $currentModel,
                                'messages' => [
                                    ['role' => 'system', 'content' => $systemPrompt],
                                    ['role' => 'user', 'content' => $userContent],
                                ],
                                'temperature' => 0.0,
                            ]);

                        if ($orResponse->successful()) {
                            $responseData = $orResponse->json();
                            $content = (string) ($responseData['choices'][0]['message']['content'] ?? '');
                            if (! empty($content)) {
                                $source = "openrouter:{$currentModel}";
                                break;
                            }
                        }
                    } catch (Throwable $e) {
                        Log::warning("OpenRouter error on {$currentModel} in TelegramOrderParser: ".$e->getMessage());
                    }
                }
            }

            if (empty($content)) {
                Log::error('All AI models failed to parse Telegram order screenshot and caption.');

                return [
                    'success' => false,
                    'reason' => 'api_error',
                    'message' => 'AI Service temporarily unavailable.',
                ];
            }

            $cleanJson = trim($content);
            if (preg_match('/\{[\s\S]*\}/', $cleanJson, $jsonMatches)) {
                $cleanJson = $jsonMatches[0];
            }

            $parsed = json_decode($cleanJson, true);
            if (! is_array($parsed)) {
                Log::warning('AI returned invalid JSON in TelegramOrderParser', ['source' => $source, 'content' => $content]);

                return [
                    'success' => false,
                    'reason' => 'invalid_ai_response',
                    'message' => 'Could not parse AI response.',
                ];
            }

            $phone = $this->normalizePhone((string) ($parsed['customer_phone'] ?? ''));
            $addr = trim((string) ($parsed['delivery_address'] ?? $parsed['address'] ?? ''));
            $notes = trim((string) ($parsed['delivery_notes'] ?? ''));

            if (! empty($notes)) {
                $lines = preg_split('/\r\n|\r|\n/', $notes);
                $cleanLines = [];
                foreach ($lines as $line) {
                    $trimmed = trim($line);
                    if ($trimmed === '') {
                        continue;
                    }
                    if (preg_match('/^(?:cod|prepaid|paid|deposit|advance|ငွေချေ|ငွေလွှဲ|တန်ဆာခ|ပစ္စည်းရောက်ငွေချေ|စရန်ငွေ|စရန်|ကြိုလွှဲ|ငွေကြိုလွှဲ|ကြိုရှင်း|ရှင်းပြီး)(?:\s*(?:ရယူမည်|ရလား|ယူမည်|ပါ|နော်|နှင့်|ဖြင့်|ရှင်းပြီး|ရှင်းပေးပါ|[-:=]?\s*\d+.*))?$/iu', $trimmed) ||
                        preg_match('/^(?:တစုံယူမယ်နော်|တစ်စုံယူမယ်နော်|၁စုံယူမယ်နော်|မှာမယ်နော်)$/u', $trimmed)) {
                        continue;
                    }
                    $cleanLines[] = $trimmed;
                }
                $notes = implode("\n", $cleanLines);
            }

            $paidAmount = 0.0;
            if (isset($parsed['paid_amount'])) {
                $rawPaid = trim((string) $parsed['paid_amount']);
                $normalizedPaid = $this->normalizeDigits($rawPaid);
                $normalizedPaid = (string) preg_replace('/(\d+),(?=\d{3}(\b|\D))/', '$1', $normalizedPaid);
                $isK = (bool) preg_match('/^\s*\d+(?:\.\d+)?\s*[kK]\b/iu', $normalizedPaid);
                $cleanPaid = preg_replace('/[^\d.]/', '', $normalizedPaid);
                if (is_numeric($cleanPaid)) {
                    $val = (float) $cleanPaid;
                    if ($isK) {
                        $val *= 1000;
                    }
                    $paidAmount = max(0.0, $val);
                }
            }

            if ($paidAmount <= 0.0 && ! empty($caption)) {
                $fallbackPaid = $this->extractPrepaidAmount($caption);
                if ($fallbackPaid > 0.0) {
                    $paidAmount = $fallbackPaid;
                }
            }

            $items = [];
            $rawItems = $parsed['items'] ?? [];
            if (! empty($rawItems) && is_array($rawItems)) {
                foreach ($rawItems as $item) {
                    $rawVariantId = $this->normalizeDigits((string) ($item['product_variant_id'] ?? ''));
                    if (is_numeric($rawVariantId)) {
                        $rawQty = $this->normalizeDigits((string) ($item['quantity'] ?? '1'));
                        $items[] = [
                            'product_variant_id' => (int) $rawVariantId,
                            'quantity' => max(1, (int) $rawQty),
                        ];
                    }
                }
            } elseif (isset($parsed['product_variant_id'])) {
                $rawVariantId = $this->normalizeDigits((string) $parsed['product_variant_id']);
                if (is_numeric($rawVariantId)) {
                    $rawQty = $this->normalizeDigits((string) ($parsed['quantity'] ?? '1'));
                    $items[] = [
                        'product_variant_id' => (int) $rawVariantId,
                        'quantity' => max(1, (int) $rawQty),
                    ];
                }
            }

            return [
                'success' => true,
                'data' => [
                    'customer_name' => trim((string) ($parsed['customer_name'] ?? '')),
                    'customer_phone' => $phone,
                    'delivery_address' => $addr,
                    'delivery_notes' => $notes,
                    'paid_amount' => $paidAmount,
                    'items' => $items,
                ],
            ];
        } catch (Throwable $e) {
            Log::error('Telegram order parser exception: '.$e->getMessage());

            return [
                'success' => false,
                'reason' => 'exception',
                'message' => 'AI order parsing error: '.$e->getMessage(),
            ];
        }
    }

    public function normalizeDigits(string $str): string
    {
        return strtr($str, [
            '၀' => '0', '၁' => '1', '၂' => '2', '၃' => '3', '၄' => '4',
            '၅' => '5', '၆' => '6', '၇' => '7', '၈' => '8', '၉' => '9',
        ]);
    }

    public function extractPrepaidAmount(string $caption): float
    {
        $normalized = $this->normalizeDigits($caption);
        $normalized = (string) preg_replace('/(\d+),(?=\d{3}(\b|\D))/', '$1', $normalized);
        $keywords = 'prepaid|paid|deposit|advance|စရန်ငွေ|စရန်|ငွေကြိုလွှဲ|ကြိုလွှဲ|ကြိုရှင်း|ရှင်းပြီး';

        // 1. Keyword before amount: e.g. "prepaid - 12000", "prepaid 12k", "စရန်ငွေ 12,000 ks"
        if (preg_match("/(?:{$keywords})\s*[-:=]?\s*(\d+(?:\.\d+)?)\s*(?:(ks|kyats?|mmk|ကျပ်)|([kK])(?![a-zA-Z]))?/iu", $normalized, $matches)) {
            $val = (float) $matches[1];
            if (! empty($matches[3])) {
                $val *= 1000;
            }

            return $val;
        }

        // 2. Amount before keyword: e.g. "12000 prepaid", "12k paid", "12000 ks စရန်", "၁၂၀၀၀ စရန်ငွေ"
        if (preg_match("/(\d+(?:\.\d+)?)\s*(?:(ks|kyats?|mmk|ကျပ်)|([kK])(?![a-zA-Z]))?\s*[-:=]?\s*(?:{$keywords})/iu", $normalized, $matches)) {
            $val = (float) $matches[1];
            if (! empty($matches[3])) {
                $val *= 1000;
            }

            return $val;
        }

        return 0.0;
    }

    private function normalizePhone(string $phone): string
    {
        $phone = $this->normalizeDigits(trim($phone));

        preg_match_all('/(?:\+?95\s*9|0\s*9)[\s\-\.]*(?:\d[\s\-\.]*){7,9}\b/', $phone, $phoneMatches);
        if (! empty($phoneMatches[0])) {
            $cleanedPhones = [];
            foreach ($phoneMatches[0] as $rawPh) {
                $cleanPh = (string) preg_replace('/[\s\-\.\+]/', '', $rawPh);
                if (str_starts_with($cleanPh, '959')) {
                    $cleanPh = '09'.substr($cleanPh, 3);
                } elseif (! str_starts_with($cleanPh, '09') && str_starts_with($cleanPh, '9')) {
                    $cleanPh = '0'.$cleanPh;
                }
                if (! in_array($cleanPh, $cleanedPhones, true)) {
                    $cleanedPhones[] = $cleanPh;
                }
            }

            return implode(', ', $cleanedPhones);
        }

        return (string) preg_replace('/[^\d+,\/\s-]/', '', $phone);
    }
}
