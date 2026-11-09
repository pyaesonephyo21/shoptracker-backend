<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class AiAddressParserService
{
    /**
     * Parse raw Myanmar chat message text or image for Address Paste (Web UI).
     *
     * @return array<string, mixed>
     */
    public function parse(string $rawText = '', ?string $imageBase64 = null, ?string $imageMimeType = null): array
    {
        return $this->parseAddress($rawText, $imageBase64, $imageMimeType);
    }

    /**
     * Parse customer recipient details from text or image.
     *
     * @return array<string, mixed>
     */
    public function parseAddress(string $rawText = '', ?string $imageBase64 = null, ?string $imageMimeType = null): array
    {
        if (empty(trim($rawText)) && empty($imageBase64)) {
            return [
                'success' => false,
                'reason' => 'empty_input',
                'message' => 'Please provide message text or an image to parse.',
            ];
        }

        $systemPrompt = $this->buildAddressSystemPrompt();
        $promptText = trim($rawText);
        if (empty($promptText) && ! empty($imageBase64)) {
            $promptText = 'Extract customer name, phone number, delivery address, and delivery notes from this photo or screenshot into the structured JSON schema.';
        }

        $result = $this->executeAi($systemPrompt, $promptText, $imageBase64, $imageMimeType);
        if (! ($result['success'] ?? false)) {
            return $result;
        }

        $parsed = $result['data'] ?? [];
        $address = (string) ($parsed['address'] ?? $parsed['delivery_address'] ?? '');

        return [
            'success' => true,
            'source' => $result['source'] ?? 'ai',
            'data' => [
                'customer_name' => (string) ($parsed['customer_name'] ?? ''),
                'customer_phone' => $this->normalizeDigits((string) ($parsed['customer_phone'] ?? '')),
                'address' => $address,
                'delivery_address' => $address,
                'delivery_notes' => $this->cleanDeliveryNotes((string) ($parsed['delivery_notes'] ?? '')),
            ],
        ];
    }

    /**
     * Parse order screenshot and caption, matching against active candidate product variants (Telegram / Full Orders).
     *
     * @param  array<int, array<string, mixed>>  $candidateVariants
     * @return array<string, mixed>
     */
    public function parseOrder(
        string $caption,
        ?string $imageBase64 = null,
        ?string $imageMimeType = null,
        array $candidateVariants = []
    ): array {
        if (empty(trim($caption)) && empty($imageBase64)) {
            return [
                'success' => false,
                'reason' => 'empty_input',
                'message' => 'Please provide an order caption or screenshot.',
            ];
        }

        $systemPrompt = $this->buildOrderSystemPrompt($candidateVariants);
        $promptText = trim($caption);
        if (empty($promptText)) {
            $promptText = 'Extract customer details from the screenshot and match ordered products from the candidates list.';
        } else {
            $promptText = "Order caption: {$promptText}\n\nExtract customer recipient details from the screenshot, and match the ordered products from the caption against the candidates list.";
        }

        $result = $this->executeAi($systemPrompt, $promptText, $imageBase64, $imageMimeType);
        if (! ($result['success'] ?? false)) {
            return $result;
        }

        $parsed = $result['data'] ?? [];
        $items = $parsed['items'] ?? [];
        $normalizedItems = [];

        if (is_array($items)) {
            foreach ($items as $item) {
                if (isset($item['product_variant_id'])) {
                    $rawVid = $item['product_variant_id'];
                    $normVid = is_string($rawVid) ? $this->normalizeDigits((string) $rawVid) : $rawVid;

                    $rawQty = $item['quantity'] ?? 1;
                    $normalizedQty = is_string($rawQty) ? $this->normalizeDigits((string) $rawQty) : $rawQty;

                    $normalizedItems[] = [
                        'product_variant_id' => (int) $normVid,
                        'quantity' => max(1, (int) $normalizedQty),
                    ];
                }
            }
        }

        $paidAmount = 0.0;
        if (isset($parsed['paid_amount'])) {
            $rawPaid = $parsed['paid_amount'];
            if (is_numeric($rawPaid)) {
                $paidAmount = max(0.0, (float) $rawPaid);
            } elseif (is_string($rawPaid)) {
                $normPaid = $this->normalizeDigits(trim($rawPaid));
                if (preg_match('/^(\d+(?:\.\d+)?)\s*k$/i', $normPaid, $kMatch)) {
                    $paidAmount = ((float) $kMatch[1]) * 1000;
                } else {
                    $cleanDigits = preg_replace('/[^\d.]/', '', $normPaid);
                    $paidAmount = is_numeric($cleanDigits) ? max(0.0, (float) $cleanDigits) : 0.0;
                }
            }
        }

        if ($paidAmount <= 0.0 && ! empty($caption)) {
            $fallbackPaid = $this->extractPrepaidAmount($caption);
            if ($fallbackPaid > 0.0) {
                $paidAmount = $fallbackPaid;
            }
        }

        $address = (string) ($parsed['delivery_address'] ?? $parsed['address'] ?? '');

        return [
            'success' => true,
            'source' => $result['source'] ?? 'ai',
            'data' => [
                'customer_name' => (string) ($parsed['customer_name'] ?? ''),
                'customer_phone' => $this->normalizeDigits((string) ($parsed['customer_phone'] ?? '')),
                'delivery_address' => $address,
                'delivery_notes' => $this->cleanDeliveryNotes((string) ($parsed['delivery_notes'] ?? '')),
                'paid_amount' => $paidAmount,
                'items' => $normalizedItems,
            ],
        ];
    }

    /**
     * Shared AI execution pipeline across Gemini models and OpenRouter fallback.
     *
     * @return array<string, mixed>
     */
    private function executeAi(
        string $systemPrompt,
        string $promptText,
        ?string $imageBase64,
        ?string $imageMimeType
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

        if (! empty($imageBase64)) {
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $imageBase64, $matches)) {
                $imageMimeType = $matches[1];
                $imageBase64 = $matches[2];
            }
            $imageBase64 = (string) preg_replace('/\s+/', '', $imageBase64);
            $imageMimeType = $imageMimeType ?: 'image/jpeg';
        }

        $content = '';
        $source = '';

        // 1. Try Google Gemini Models
        if (! empty($geminiKey)) {
            $geminiModels = [
                'gemini-3.5-flash-lite',
                'gemini-3.8-flash',
                'gemini-3.1-flash-lite',
            ];

            $userParts = [];
            if (! empty($imageBase64)) {
                $userParts[] = [
                    'inlineData' => [
                        'mimeType' => $imageMimeType,
                        'data' => $imageBase64,
                    ],
                ];
            }
            if (! empty($promptText)) {
                $userParts[] = ['text' => $promptText];
            }

            foreach ($geminiModels as $gModel) {
                try {
                    $http = Http::connectTimeout(10)->timeout(45)
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
                            ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_NONE'],
                            ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_NONE'],
                            ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_NONE'],
                            ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_NONE'],
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

                    Log::warning("Gemini model {$gModel} failed in AiAddressParser (status: {$geminiResponse->status()})");
                } catch (Throwable $e) {
                    Log::warning("Gemini connection error on {$gModel} in AiAddressParser: ".$e->getMessage());

                    $msg = strtolower($e->getMessage());
                    if (str_contains($msg, 'could not resolve host') || str_contains($msg, 'curl error 6')) {
                        break;
                    }
                }
            }
        }

        // 2. Try OpenRouter Fallback Chain
        if (empty($content) && ! empty($openRouterKey)) {
            $primaryModel = (string) config('services.openrouter.model', 'nvidia/nemotron-3.5-super-vl:free');
            $modelChain = array_unique([
                $primaryModel,
                'nvidia/nemotron-3.5-super-vl:free',
                'google/gemma-4-26b-a4b-it:free',
                'google/gemma-4-31b-it:free',
            ]);

            $userContent = [];
            if (! empty($imageBase64)) {
                if (! empty($promptText)) {
                    $userContent[] = ['type' => 'text', 'text' => $promptText];
                }
                $userContent[] = [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => "data:{$imageMimeType};base64,{$imageBase64}",
                    ],
                ];
            } else {
                $userContent = $promptText;
            }

            foreach ($modelChain as $currentModel) {
                try {
                    $orResponse = Http::connectTimeout(10)->timeout(45)
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

                    Log::warning("OpenRouter model {$currentModel} failed (status: {$orResponse->status()})");
                } catch (Throwable $e) {
                    Log::warning("OpenRouter connection error on {$currentModel}: ".$e->getMessage());
                }
            }
        }

        if (empty($content)) {
            return [
                'success' => false,
                'reason' => 'ai_service_unavailable',
                'message' => 'AI parsing service timed out or was temporarily unavailable. Please try again.',
            ];
        }

        $jsonStr = trim($content);
        if (preg_match('/\{[\s\S]*\}/', $jsonStr, $matches)) {
            $jsonStr = $matches[0];
        }

        $decoded = json_decode($jsonStr, true);
        if (! is_array($decoded)) {
            Log::error('AI parser returned invalid JSON', ['raw' => $content]);

            return [
                'success' => false,
                'reason' => 'invalid_json',
                'message' => 'AI failed to produce structured JSON data.',
            ];
        }

        return [
            'success' => true,
            'source' => $source,
            'data' => $decoded,
        ];
    }

    /**
     * Common Myanmar address OCR system prompt rules.
     */
    private function buildBaseOcrInstructions(): string
    {
        return <<<'PROMPT'
You are an expert AI assistant specialized in parsing Myanmar e-commerce customer information from chat messages, text, screenshots of chat conversations (e.g. Facebook Messenger, Viber, Telegram), delivery slips, waybills, and handwritten delivery notes into clean, structured customer and delivery details.

If an image or screenshot is provided:
- Carefully perform OCR to read all text, including Myanmar (Burmese) script and English.
- Locate sender/recipient information. Distinguish between seller/shop information and buyer/recipient (customer) information. Extract the BUYER / RECIPIENT customer details.
- Identify the dedicated customer info bubble (e.g., Name, Address, Phone block sent by customer).

CRITICAL OCR & GEOGRAPHY ACCURACY GUIDELINES FOR BURMESE SCRIPT:
1. Myanmar Ward (ရပ်ကွက်) Systems:
   Myanmar addresses use three distinct ward naming systems:
   - Numbered Wards (ဂဏန်း ရပ်ကွက်): E.g., ၁ ရပ်ကွက်, ၂ ရပ်ကွက်, ၁၀ ရပ်ကွက်, ၁၁ ရပ်ကွက်, ၁၂ ရပ်ကွက်, ၁၆ ရပ်ကွက်.
     * Wards are frequently double-digits (e.g., ၁၀, ၁၁, ၁၂, ၁၃, ၁၄, ၁၅, ၁၆).
     * Look closely at the circular loops before 'ရပ်ကွက်'. When there are two consecutive numeral 1s side-by-side ('၁၁'), transcribe accurately as '၁၁ ရပ်ကွက်' (Ward 11). Do not collapse or drop '၁၁' into a single '၁', and do not mistake for consonants 'ဘ' or 'သ'.
     * In townships that strictly use numbered wards (e.g. ဓနုဖြူ, သာကေတ, လှိုင်သာယာ, ဒဂုံ), recognize the number: e.g. '၁၁ ရပ်ကွက်' (Ward 11).
   - Alphabetical Wards (အက္ခရာ ရပ်ကွက်): E.g., က ရပ်ကွက်, ခ ရပ်ကွက်, ဈ ရပ်ကွက်, ဘ ရပ်ကွက်, မ ရပ်ကွက်.
     * Certain towns (e.g., တောင်ငူ, မော်လမြိုင်, ပြည်, ပုသိမ်) use Burmese alphabet letters. When an alphabetical ward is genuinely indicated (e.g., 'ဘ ရပ်ကွက်', '(ဘ) ရပ်ကွက်', 'ဈ ရပ်ကွက်'), preserve the letter faithfully.
   - Named Wards (အမည်ပေး ရပ်ကွက်): E.g., ဈေးရပ်ကွက်, မင်္ဂလာရပ်ကွက်, ရွာသစ်ရပ်ကွက်, သီရိရပ်ကွက်. Preserve compound named wards accurately.
2. Myanmar Township & City Validation:
   - Validate against real, legitimate Myanmar townships and cities.
   - Disambiguate common visual confusions in rounded Burmese script:
     * 'ဓ' (Dha) vs 'စ' (Sa) vs 'မ' (Ma): E.g., 'ဓနုဖြူ' (Danubyu Township in Ayeyarwady), NOT 'စနုဖြူ' or 'မနုဖြူ' or 'စခုဖြူ'.
     * '၁' (Burmese numeral 1) vs 'ဝ' (letter Wa) vs '၀' (numeral 0).
   - Validate genuine townships such as 'ဓနုဖြူ', 'ရေနံချောင်း', 'ချောက်', 'မိုးကုတ်', 'သာကေတ', 'ဒလ', 'မြောက်ဒဂုံ', 'လှိုင်သာယာ', etc.
3. Delivery Remarks / Notes Filtering:
   - ONLY include specific logistics constraints or customer delivery requests (e.g., "ကျောင်းဖွင့်ရက်မှပို့ပါ", "မနက်ပိုင်းပဲဆက်ပါ", "ရုံးချိန်ပို့ပေးပါ", "မပို့ခင်ဖုန်းဆက်ပါ", "ကားဂိတ်ချိန်းပါ").
   - CRITICAL: NEVER extract payment methods (e.g., "COD", "Cod ရယူမည်", "Cod ရလား", "ငွေလွှဲ"), order intent (e.g., "တစုံယူမယ်နော်", "မှာမယ်နော်"), or conversational greetings into delivery notes.
   - If no specific logistics constraints are present, leave delivery_notes as empty string ("").

Your extraction goals:
1. Customer Name:
   - Extract the real person's complete name.
   - Preserve genuine name honorifics if present (e.g., "ကို", "မ", "မောင်", "ဒေါ်", "ဦး", "Dr.").
   - CRITICAL: Never truncate legitimate Burmese name syllables (e.g., "ခင်", "ဝင်း", "အေး", "ဖြူ", "နွယ်", "မိုး", "ထွေး", "ဆွေ", "ကြည်"). For example, "မအိမ့်မှူးခင်" must be preserved as "မအိမ့်မှူးခင်", NOT "မအိမ့်မှူး". "ခင်" is a standard name syllable, not a polite particle.
   - Strip conversational vocatives & greetings (e.g., "မင်္ဂလာပါ", "အမရေ", "အစ်မ", "အကို", "ညီမလေး", "Name:", "Acc Name:", "Customer Name:").
   - Only strip polite particles when they are standalone sentence endings (e.g., "ပါရှင့်", "ပါခင်ဗျာ", "ပါဗျ", "ပါနော်", "ပါ့မယ်", "ရှင့်", "ကတော့"). Never cut into the person's actual name. Example: "ကိုဝင်းဇော်ခင်ဗျာ" -> "ကိုဝင်းဇော်", but "မအိမ့်မှူးခင်" -> "မအိမ့်မှူးခင်".
   - Never mistake ordered items (e.g. "T-shirt 2 ထည်", "Lipstick", "Dress M size", "တစုံယူမယ်နော်") for the customer name.

2. Customer Phone:
   - Extract Myanmar phone numbers.
   - Normalize Burmese digits (၀-၉) to standard English digits (0-9).
   - Format cleanly as standard Myanmar phone format (e.g., "09XXXXXXXXX").
   - If there are multiple phone numbers, extract all of them separated by a comma (e.g., "09772775937, 09776573573").
   - If a 2nd phone number is missing 09 (e.g. "09772775937 / 776573573"), restore the full 09 prefix.

3. Delivery Address:
   - Extract full address including city, township, street name, house/building number, ward (ရပ်ကွက်), landmarks, school/office buildings, hostels/halls (ဆောင်), and Highway Express gates (ကားဂိတ် / အဝေးပြေးဂိတ်).
   - If message components are delimited by slashes (/), commas, or newlines, extract all address components cleanly.
   - Format with neat Burmese commas (၊) or spaces between components for readability.
   - Example: "၁၁ရပ်ကွက် ဓနုဖြူမြို့" -> "၁၁ ရပ်ကွက်၊ ဓနုဖြူမြို့".
PROMPT;
    }

    private function buildAddressSystemPrompt(): string
    {
        $base = $this->buildBaseOcrInstructions();

        return <<<PROMPT
{$base}

Return ONLY a valid JSON object without markdown code blocks (no ```json fences) in this exact schema:
{
  "customer_name": "...",
  "customer_phone": "...",
  "address": "...",
  "delivery_notes": ""
}
PROMPT;
    }

    /**
     * @param  array<int, array<string, mixed>>  $candidateVariants
     */
    private function buildOrderSystemPrompt(array $candidateVariants): string
    {
        $base = $this->buildBaseOcrInstructions();
        $variantsJson = json_encode($candidateVariants, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        return <<<PROMPT
{$base}

You are also provided with:
1. An order caption or text written by the sales team (e.g. "Infinity Silver 1 prepaid - 12000" or "Cotton T-shirt Red M 2").
2. A JSON list of active product variants available in the shop:
{$variantsJson}

Additional Order Processing Goals:
4. Match the ordered product(s) and variant(s):
   - Read the sales team's caption and match against the provided candidate product variants list.
   - Compare product name, variant SKU, and variant attributes (e.g. color, size).
   - Extract the exact candidate "id" as "product_variant_id", and the ordered "quantity" (integer >= 1, defaults to 1).
   - If multiple products are mentioned, include each matched product in the "items" list.
   - If a product cannot be confidently matched to the candidates list, omit it from the items list.

5. Payment / Prepaid Extraction:
   - Look for any prepaid, deposit, advance, or paid amounts indicated in the sales caption or screenshot.
   - Keywords include: "prepaid", "prepaid -", "paid", "advance", "deposit", "စရန်", "စရန်ငွေ", "ငွေကြိုလွှဲ", "ကြိုရှင်း", "ရှင်းပြီး".
   - Notice both keyword orders: e.g. "prepaid - 12000", "prepaid 12000", "12000 prepaid", "12k prepaid", "စရန်ငွေ 12000", "၁၂၀၀၀ စရန်".
   - Convert shorthand notation: "12k" -> 12000, "15.5k" -> 15500.
   - Extract this numerical value as "paid_amount" (number, default 0 if not paid/prepaid).
   - Do NOT confuse product quantities (e.g. "1 ထည်", "2 pcs") with prepaid amounts (e.g. "12000 ks", "12000").

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
    }

    /**
     * Normalize Burmese digits to English digits.
     */
    public function normalizeDigits(string $str): string
    {
        $burmeseDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
        $englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        return str_replace($burmeseDigits, $englishDigits, $str);
    }

    /**
     * Fallback regex to extract prepaid amounts from order captions.
     */
    public function extractPrepaidAmount(string $caption): float
    {
        $normalized = $this->normalizeDigits($caption);

        $keywords = 'prepaid|paid|advance|deposit|စရန်ငွေ|စရန်|ငွေကြိုလွှဲ|ကြိုလွှဲ|ငွေလွှဲ|ကြိုရှင်း|ရှင်းပြီး';

        // 1. Keyword first: "prepaid - 12000", "prepaid 12k", "စရန် 12000"
        if (preg_match('/(?:'.$keywords.')\s*[-:=]?\s*(\d+(?:[,\.]\d+)*)\s*(ks|kyats?|ကျပ်|k)?(?!\d)/iu', $normalized, $matches)) {
            $val = (float) str_replace(',', '', $matches[1]);
            if (! empty($matches[2]) && strtolower($matches[2]) === 'k') {
                $val *= 1000;
            }

            return max(0.0, $val);
        }

        // 2. Amount first: "12000 prepaid", "12k prepaid", "12000 စရန်"
        if (preg_match('/(\d+(?:[,\.]\d+)*)\s*(ks|kyats?|ကျပ်|k)?\s*[-:=]?\s*(?:'.$keywords.')/iu', $normalized, $matches)) {
            $val = (float) str_replace(',', '', $matches[1]);
            if (! empty($matches[2]) && strtolower($matches[2]) === 'k') {
                $val *= 1000;
            }

            return max(0.0, $val);
        }

        return 0.0;
    }

    /**
     * Clean payment notes from delivery notes.
     */
    public function cleanDeliveryNotes(string $notes): string
    {
        $notes = trim($notes);
        if (empty($notes)) {
            return '';
        }

        $lines = preg_split('/\r\n|\r|\n/', $notes);
        if (! is_array($lines)) {
            return '';
        }

        $filtered = [];
        $paymentKeywords = 'cod|ငွေလွှဲ|prepaid|paid|advance|deposit|စရန်|kpay|wave';

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (empty($trimmed)) {
                continue;
            }

            if (preg_match('/^\s*(?:'.$paymentKeywords.')\b/iu', $trimmed)) {
                continue;
            }

            $filtered[] = $trimmed;
        }

        return implode("\n", $filtered);
    }
}
