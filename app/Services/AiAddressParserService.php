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
        $rawAddress = (string) ($parsed['address'] ?? $parsed['delivery_address'] ?? '');
        $rawPhone = (string) ($parsed['customer_phone'] ?? '');
        $rawNotes = (string) ($parsed['delivery_notes'] ?? '');

        $formatted = $this->formatAddressAndNotes($rawPhone, $rawAddress, $rawNotes);

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

        if ($paidAmount <= 0.0 && ! empty($rawText)) {
            $fallbackPaid = $this->extractPrepaidAmount($rawText);
            if ($fallbackPaid > 0.0) {
                $paidAmount = $fallbackPaid;
            }
        }

        return [
            'success' => true,
            'source' => $result['source'] ?? 'ai',
            'data' => [
                'customer_name' => (string) ($parsed['customer_name'] ?? ''),
                'customer_phone' => $formatted['customer_phone'],
                'address' => $formatted['address'],
                'delivery_address' => $formatted['address'],
                'delivery_notes' => $formatted['delivery_notes'],
                'paid_amount' => $paidAmount,
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

        $rawAddress = (string) ($parsed['delivery_address'] ?? $parsed['address'] ?? '');
        $rawPhone = (string) ($parsed['customer_phone'] ?? '');
        $rawNotes = (string) ($parsed['delivery_notes'] ?? '');

        $formatted = $this->formatAddressAndNotes($rawPhone, $rawAddress, $rawNotes);

        return [
            'success' => true,
            'source' => $result['source'] ?? 'ai',
            'data' => [
                'customer_name' => (string) ($parsed['customer_name'] ?? ''),
                'customer_phone' => $formatted['customer_phone'],
                'delivery_address' => $formatted['address'],
                'delivery_notes' => $formatted['delivery_notes'],
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
                'gemini-3.5-flash',
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
- Distinguish between seller/shop information (outgoing messages, right side, avatar) and buyer/recipient customer information (incoming messages, left side). Extract BUYER / RECIPIENT customer details ONLY.
- CRITICAL: NEVER extract seller/admin conversational messages (e.g., "မင်မင် deli လေးအပ်ပေးလိုက်ပါမယ်နော်", "ဟုတ် နာမည် ဖုန်းနံပါတ်လေးပါပေးပါနော်", "ဟုတ်ပါတယ်ဗျ", "ဟုတ်ကဲ့ပါ") as customer notes or customer names!

CRITICAL OCR & GEOGRAPHY ACCURACY GUIDELINES FOR BURMESE SCRIPT:
1. Myanmar Customer Name OCR & Character Distinction:
   - Carefully disambiguate visually similar Burmese characters in names:
     * 'ကြယ်' (Kya + ya-yit + ya-pet + asat = Star) vs 'ကြွယ်' (Kya + ya-yit + wa-swe = Wealthy):
       In customer names, recognize standard beloved name patterns: 'ကြယ်စင်' (Kyei Sin = Star/Constellation), 'ကြယ်စင်မိုး', 'ကြယ်စင်မိုးဦး', 'ကြယ်စင်သန့်'. Do NOT transcribe 'ကြယ်' as 'ကြွယ်'.
     * 'စ' (Sa-lone) vs 'ဇ' (Za-gwe):
       'စ' has a smooth continuous rounded crescent with an open top-right. 'ဇ' has a two-tiered notched middle loop.
       In names like 'ကြယ်စင်', the syllable is 'စင်' with 'စ', NOT 'ဇင်' with 'ဇ'. Transcribe 'ကြယ်စင်' faithfully.
     * Syllable Preservation:
       Preserve legitimate name syllables ('ခင်', 'ဝင်း', 'အေး', 'ဖြူ', 'နွယ်', 'မိုး', 'ထွေး', 'ဆွေ', 'ကြည်', 'ဦး', 'စင်', 'မင်း').
       Example: Customer bubble 'ကြယ်စင်မိုးဦး' -> 'ကြယ်စင်မိုးဦး'.
     * Honorifics & Greetings:
       Preserve genuine honorifics ('ကို', 'မ', 'မောင်', 'ဒေါ်', 'ဦး', 'Dr.'). Strip greetings ('မင်္ဂလာပါ', 'အမရေ', 'အစ်မ', 'အကို', 'ညီမလေး', 'Name:', 'Customer Name:'). Never cut into genuine name syllables.

2. Myanmar Ward (ရပ်ကွက်) & Township Geocoding Disambiguation:
   - Validate against real, legitimate Myanmar townships and registered wards:
     * 'အရိုးကုန်း' vs 'အရုံးကုန်း':
       In Tarmwe Township (တာမွေမြို့နယ်, Yangon), the official registered ward is 'အရိုးကုန်း ရပ်ကွက်' (Ayoe Kone Ward). There is NO ward named 'အရုံးကုန်း' in Tarmwe. Note the vowel combination: 'ိ' + 'ု' ('ရိုး' as in အရိုးကုန်း), NOT 'ု' + 'ံ' ('ရုံး').
     * Famous Yangon wards:
       - တာမွေ: အရိုးကုန်း, မလွှကုန်း, ကျောက်မြောင်း, နတ်မောက်, ပုသိမ်ညွန့်, မေတ္တာညွန့်.
       - စမ်းချောင်း: လင်းလွန်းတောင်, လင်းလွန်းမြောက်, ရှင်စောပု, မုန့်လက်ဆောင်းကုန်း, ဝေဠုဝန်.
       - ဗဟန်း: ဆရာစံ, ရွှေတောင်ကြား, နတ်မောက်.
       - လှိုင်: ၁ ရပ်ကွက် to ၁၆ ရပ်ကွက်.
     * Numbered Wards: E.g., ၁၀ ရပ်ကွက်, ၁၁ ရပ်ကွက်, ၁၂ ရပ်ကွက်, ၁၆ ရပ်ကွက်. Look closely at loops; do not collapse '၁၁' into '၁'.
     * Alphabetical Wards: E.g., က ရပ်ကွက်, ခ ရပ်ကွက်, ဈ ရပ်ကွက်, ဘ ရပ်ကွက် in towns like တောင်ငူ, မော်လမြိုင်, ပြည်, ပုသိမ်.
     * Towns: 'ဓနုဖြူ', 'ရေနံချောင်း', 'ချောက်', 'မိုးကုတ်', 'သာကေတ', 'ဒလ', 'မြောက်ဒဂုံ', 'လှိုင်သာယာ'.
     * Street & House numbers: E.g., 'အမှတ် ၈ ဦးလွန်းလမ်း' -> 'အမှတ် ၈၊ ဦးလွန်းလမ်း' (No. 8, U Loon Street).

3. Delivery Address & Notes Formatting (CRITICAL DELIVERY APP CONVENTIONS):
   In Myanmar e-commerce logistics, delivery apps (Ninja Van, BeeXprss, Royal Express) have only ONE phone number field and print the Address field on the parcel's waybill sticker:
   - Primary Phone Number:
     Put the single primary phone in "customer_phone" (e.g. "09266712266").
   - Secondary / Additional Phone Numbers:
     If the customer has more than one phone number, append secondary phone numbers to the END of "address" inside parentheses: e.g. "(09776573573)".
   - Courier / Delivery Rider Instructions:
     Any constraint intended for the delivery driver or specific delivery days/times MUST be appended to the END of "address" inside parentheses:
     * Call before delivery: "(မပို့ခင်ဖုန်းဆက်ပါ)" or "(call before deliver)"
     * Specific day or time: "(ရုံးချိန်တွင်းပို့ပါ)", "(ကျောင်းဖွင့်ရက်မှပို့ပါ)", "(တနင်္လာနေ့မှပို့ပါ)", "(စနေ တနင်္ဂနွေမှပို့ပါ)", "(မနက်ပိုင်းပို့ပါ)", "(ညနေပိုင်းပို့ပါ)", "(ရုံးဖွင့်ရက်ပို့ပါ)"
     * Transit / Bus terminal: "(ကားဂိတ်ပို့ပါ)", "(ဂိတ်ချိန်းပါ)"
   - Delivery Notes ("delivery_notes"):
     STRICTLY reserved for internal shop operations, seller reminders, warehouse holds, or customer financial balances:
     * Examples: "add after 2 weeks", "နောက် ၂ ပတ်မှ ပို့ပါ", "4000 remains", "ကျန်ငွေ ၄၀၀၀".
     * CRITICAL: NEVER put courier delivery instructions (e.g. call before deliver, specific delivery day) in "delivery_notes" — they belong at the end of "address" with (...).
     * If there are no internal shop remarks, leave "delivery_notes" as empty string ("").
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
  "delivery_notes": "",
  "paid_amount": 0
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
     * Post-process and normalize recipient phone, address, and delivery notes according to Myanmar delivery app conventions.
     *
     * 1. Primary phone number stays in customer_phone.
     * 2. Secondary phone numbers are appended to address in parentheses: (09XXXXXXXXX).
     * 3. Delivery rider instructions (call before deliver, deliver on specific days/times) are appended to address in parentheses: (မပို့ခင်ဖုန်းဆက်ပါ).
     * 4. Internal shop notes (e.g. "add after 2 weeks", "4000 remains", order holds) remain in delivery_notes.
     * 5. Conversational greetings and seller messages (e.g. "မင်မင် deli လေးအပ်ပေးလိုက်ပါမယ်နော်") are removed.
     *
     * @return array{customer_phone: string, address: string, delivery_notes: string}
     */
    public function formatAddressAndNotes(string $rawPhone, string $rawAddress, string $rawNotes): array
    {
        $rawPhone = $this->normalizeDigits($rawPhone);
        $rawNotes = trim($rawNotes);
        $address = trim($rawAddress);

        // 1. Phone extraction and normalization
        preg_match_all('/(?:\+?95\s*9|0\s*9)[\d\s\-\.]*/', $rawPhone, $matches);
        $cleanPhones = [];
        if (! empty($matches[0])) {
            foreach ($matches[0] as $p) {
                $c = preg_replace('/[^\d]/', '', (string) $p);
                if (str_starts_with($c, '959')) {
                    $c = '09'.substr($c, 3);
                } elseif (! str_starts_with($c, '09') && str_starts_with($c, '9')) {
                    $c = '0'.$c;
                }
                if (! empty($c) && ! in_array($c, $cleanPhones, true)) {
                    $cleanPhones[] = $c;
                }
            }
        }

        $primaryPhone = $cleanPhones[0] ?? $rawPhone;
        $secondaryPhones = array_slice($cleanPhones, 1);

        foreach ($secondaryPhones as $sp) {
            if (! str_contains($address, $sp)) {
                $address .= ' ('.$sp.')';
            }
        }

        // 2. Classify rider instructions vs internal notes
        $riderPatterns = [
            '/(?:မပို့ခင်|မပို့မီ|မရောက်ခင်)?\s*ဖုန်း(?:ကြို)?ဆက်(?:ပါ|ပေးပါ)?/iu',
            '/(?:ရုံးချိန်|ကျောင်းချိန်|ရုံးဖွင့်ရက်|ကျောင်းဖွင့်ရက်|စနေ|တနင်္ဂနွေ|တနင်္လာ|အင်္ဂါ|ဗုဒ္ဓဟူး|ကြာသပတေး|သောကြာ|မနက်ပိုင်း|ညနေပိုင်း)(?:အတွင်း|တွင်း|မှ)?\s*ပို့(?:ပေး)?ပါ?/iu',
            '/call\s+before\s+(?:deliver|delivery)/iu',
            '/deliver\s+(?:on|at)\s+[^\n,.]+/iu',
            '/(?:ကားဂိတ်|အဝေးပြေးဂိတ်|ဂိတ်)(?:ပို့|ချိန်း)(?:ပေး)?ပါ/iu',
        ];

        $conversationalPatterns = [
            '/(?:မင်မင်|admin|shop).*?(?:အပ်ပေး|ပို့ပေး|ဆက်သွယ်|ပေးလိုက်ပါမယ်)/iu',
            '/^(?:ဟုတ်ကဲ့ပါရှင့်|ဟုတ်ကဲ့ပါခင်ဗျာ|ဟုတ်ကဲ့ပါ|ဟုတ်ကဲ့|ဟုတ်ပါတယ်ဗျ|ဟုတ်ပါတယ်|ကျေးဇူးတင်ပါတယ်|ကျေးဇူးပါ)/iu',
        ];

        $riderNotes = [];
        $internalNotes = [];

        if (! empty($rawNotes)) {
            $lines = preg_split('/(?:\r?\n|၊)+/', $rawNotes);
            if (is_array($lines)) {
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) {
                        continue;
                    }

                    $isConv = false;
                    foreach ($conversationalPatterns as $cp) {
                        if (preg_match($cp, $line)) {
                            $isConv = true;
                            break;
                        }
                    }
                    if ($isConv) {
                        continue;
                    }

                    // Check payment keywords (COD, prepaid, advance, etc.)
                    $paymentKeywords = 'cod|ငွေလွှဲ|prepaid|paid|advance|deposit|စရန်|kpay|wave';
                    if (preg_match('/^\s*(?:'.$paymentKeywords.')/iu', $line)) {
                        continue;
                    }

                    $isRider = false;
                    foreach ($riderPatterns as $rp) {
                        if (preg_match($rp, $line)) {
                            $riderNotes[] = $line;
                            $isRider = true;
                            break;
                        }
                    }

                    if (! $isRider) {
                        $internalNotes[] = $line;
                    }
                }
            }
        }

        foreach ($riderNotes as $rn) {
            if (! str_contains($address, $rn)) {
                $address .= ' ('.$rn.')';
            }
        }

        // Also wrap unparenthesized rider notes directly in address if present
        foreach ($riderPatterns as $rp) {
            if (preg_match($rp, $address, $m)) {
                $matchedStr = $m[0];
                if (! preg_match('/\([^\)]*'.preg_quote($matchedStr, '/').'[^\)]*\)/u', $address)) {
                    $address = str_replace($matchedStr, '('.trim($matchedStr).')', $address);
                }
            }
        }

        $address = (string) preg_replace('/\s+/', ' ', trim($address));
        $deliveryNotes = implode(', ', $internalNotes);

        return [
            'customer_phone' => $primaryPhone,
            'address' => $address,
            'delivery_notes' => $deliveryNotes,
        ];
    }
}
