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
                'gemini-3-flash-preview',
                'gemini-3.5-flash-lite',
                'gemini-3.1-flash-lite',
                'gemini-3.8-flash',
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
                        'systemInstruction' => [
                            'parts' => [['text' => $systemPrompt]],
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
You are an expert AI assistant specialized in parsing Myanmar e-commerce customer information from chat messages, text, screenshots of chat conversations (e.g. Facebook Messenger, Viber, Telegram, TikTok), delivery slips, waybills, and handwritten delivery notes into clean, structured customer and delivery details.

If an image or screenshot is provided:
- Carefully perform OCR to read all text, including Myanmar (Burmese) script and English.
- Distinguish between seller/shop information (outgoing messages, right side, avatar) and buyer/recipient customer information (incoming messages, left side). Extract BUYER / RECIPIENT customer details ONLY.
- CRITICAL: NEVER extract seller/admin conversational messages (e.g., "မင်မင် deli လေးအပ်ပေးလိုက်ပါမယ်နော်", "deli အပ်ပြီး ၃ ရက်အတွင်းပါဗျ", "ဟုတ် နာမည် ဖုန်းနံပါတ်လေးပါပေးပါနော်", "ဟုတ်ပါတယ်ဗျ", "ဟုတ်ကဲ့ပါ") as customer notes or customer names! Right-side / colored bubbles are shop admin replies, NOT buyer notes!

CRITICAL OCR & GEOGRAPHY ACCURACY GUIDELINES FOR BURMESE SCRIPT:
1. Myanmar Customer Name OCR & Priority:
   - Explicitly Provided Name Priority:
     When the customer explicitly provides their recipient name in a chat bubble (e.g. "Thuလို့ပဲထည့်ပေးရှင်" -> "Thu", "နာမည်က မသု ပါ" -> "မသု", "ကိုဖြိုး ပါ" -> "ကိုဖြိုး"), ALWAYS extract that explicitly provided name. NEVER fall back to single-letter avatar handles or top-bar UI window titles (e.g. "T", "_kosima; j") when the customer has stated their name in the conversation!
   - Disambiguate visually similar Burmese characters in names:
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

2. Burmese Stacked Pali Consonants (ပါဠိဆင့် Ligatures) Disambiguation:
   Myanmar addresses frequently contain classical Pali stacked consonants (two consonants stacked vertically with an implicit virama/asat):
   - 'မ္မ' (stacked ma under ma):
     * 'ဘုမ္မာ' (Bhomma: ဘ + ု + မ္မ + ာ) -> Found in North Okkalapa street series: 'ဘုမ္မာလမ်း', 'ဘုမ္မာ ၁ လမ်း' to 'ဘုမ္မာ ၂၀ လမ်း'.
       CRITICAL: NEVER confuse 'ဘုမ္မာ' with dictionary words like 'ဗဟူသုတ' or 'ဗဟိုသုခ'!
     * 'သုဓမ္မာ' (Sudhamma: သု + ဓမ္မ + ာ) -> Major artery road in North Okkalapa: 'သုဓမ္မာလမ်း'.
     * 'ပဒုမ္မာ' (Padomma: ပ + ဒု + မ္မ + ာ) -> 'ပဒုမ္မာလမ်း' (Sanchaung, North Okkalapa).
     * 'ဓမ္မဝိဟာရ', 'ဓမ္မဒူတ'.
   - 'န္ဒ' (stacked da under na):
     * 'နန္ဒာ' (Nandar: န + န္ဒ + ာ) -> North Okkalapa series: 'နန္ဒာလမ်း', 'နန္ဒာ ၁ လမ်း' to 'နန္ဒာ ၁၆ လမ်း'.
     * 'မင်းနန္ဒာ' (Min Nandar road in Dawbon), 'ဗန္ဓုလ' (Maha Bandoola), 'အာနန္ဒာ'.
   - 'က္က' (stacked ka under ka):
     * 'ဥက္ကလာပ' (Okkalapa: ဥ + က္က + လာ + ပ) -> 'မြောက်ဥက္ကလာပ', 'တောင်ဥက္ကလာပ'.
     * 'ပေါက္ကံ' (Paukkan), 'သက္က'.
   - 'တ္တ' (stacked ta under ta):
     * 'ဥတ္တရသီရိ', 'ရတ္တ'.
   - 'င်္ဂ' (stacked nga ligature):
     * 'သင်္ဃန်းကျွန်း' (Thingangyun), 'မင်္ဂလာဒုံ' (Mingaladon), 'မင်္ဂလာတောင်ညွန့်'.
   - 'ဉ္ဇ' (stacked za under nya):
     * 'ဝေဇယန္တာ' (Wayzayanta road in South Okkalapa / Thingangyun).

3. Myanmar Digits, Alphabetical Street Series & House Number Precision:
   - Digits in Street Numbers:
     In Myanmar townships, streets are heavily numbered using Burmese numerals: '၁, ၂, ၃, ၄, ၅, ၆, ၇, ၈, ၉, ၁၀, ၁၁, ၁၂, ၁၃, ၁၄, ၁၅ ... ၁၀၀+ လမ်း'.
     * When an address contains a street series with a number (e.g. 'ဘုမ္မာ၁၃လမ်း' or 'ဘုမ္မာ ၁၃ လမ်း' = Bhomma 13th Street), NEVER drop the number to just 'ဘုမ္မာလမ်း' or 'နန္ဒာလမ်း'. Always preserve the full numbered street: 'ဘုမ္မာ ၁၃ လမ်း'!
     * NEVER drop, ignore, or squash Burmese numerals before 'လမ်း'.
   - Alphabetical Wards & Street Series (အက္ခရာ လမ်းစဉ်များ):
     In townships like Insein (အင်းစိန်), North Okkalapa (မြောက်ဥက္ကလာပ), Thingangyun, Dagon, etc., streets and wards are designated by single Burmese alphabet letters followed by a street number:
     * Examples: 'က ၁ လမ်း', 'က ၂ လမ်း', 'ခ ၁ လမ်း', 'ခ ၂ လမ်း', 'ခ ၃ လမ်း', 'ခ ၄ လမ်း', 'ဂ ၁ လမ်း', 'ဈ ၁ လမ်း'.
     * CRITICAL: '၃' (Burmese numeral 3) vs 'ည' (letter Nya):
       When an alphabet letter (such as 'ခ') is followed by a curved glyph before 'လမ်း' (e.g. 'ခ၃လမ်း'), it is the numeral '၃' (3), representing 'ခ ၃ လမ်း' (Kha 3rd Street).
       NEVER transcribe this as 'ခညလမ်း' (there is no street named 'ခည')! Always transcribe both the alphabet letter and the numeral: 'ခ ၃ လမ်း'.
     * NEVER drop the alphabet letter (e.g. do NOT reduce 'ခ ၃ လမ်း' to just '၃ လမ်း').
   - Multi-Digit House Numbers (အိမ်အမှတ်):
     House numbers in Myanmar frequently consist of multiple digits (e.g. 'အမှတ် ၄၆', 'အမှတ် ၁၂၈', 'အမှတ် ၅၅', 'အမှတ် ၄/B'):
     * In unspaced text like 'အမှတ်၄၆အင်းစိန်', carefully read all digits after 'အမှတ်': 'အမှတ် ၄၆' (No. 46), followed by the township 'အင်းစိန်'.
     * NEVER truncate or drop digits from house numbers (e.g., do NOT turn 'အမှတ် ၄၆' into 'အမှတ် ၄').

4. Authoritative Myanmar Postal & Urban Geography Directory:
   Always cross-check extracted text against real, legitimate Myanmar administrative divisions:
   - Yangon Municipal Townships (၃၃ မြို့နယ်):
     * အင်းစိန် (Insein):
       - Alphabetical Street Series: က, ခ, ဂ, ဃ, င, စ, ဆ, ဇ, ဈ, ည (ဥပမာ: ခ ၁ လမ်း, ခ ၂ လမ်း, ခ ၃ လမ်း).
       - Wards: နံ့သာကုန်း, ရွာမ, စဉ့်ငူ, သုခ, အောင်ဆန်း, ကမ်းနား.
     * မြောက်ဥက္ကလာပ (North Okkalapa):
       - Wards: က, ခ, ဂ, ဃ, င, စ, ဆ, ဇ, ဈ, ည, ဋ, ဌ, ဍ, ဎ, ဏ, တ, ထ ရပ်ကွက်.
       - Street Series: ဘုမ္မာ (၁ မှ ၂၀) လမ်းများ, နန္ဒာ (၁ မှ ၁၆) လမ်းများ, ကံ့ကော် (၁ မှ ၁၀) လမ်းများ, သုဓမ္မာလမ်း, မေဓာဝီလမ်း, ခေမာသီလမ်း, ဝေဘာဂီလမ်း, ပဒုမ္မာလမ်း, သုမင်္ဂလာလမ်း, တကောင်းလမ်း, ရွှေပေါက္ကံလမ်း.
     * တောင်ဥက္ကလာပ (South Okkalapa):
       - Wards: ၁ မှ ၁၄ ရပ်ကွက်.
       - Roads: သံသုမာလမ်း, ဇေယျာမာလာလမ်း, ရတနာလမ်း, ပဒေသာလမ်း, ဝေဇယန္တာလမ်း, မေတ္တာလမ်း, ဗြဟ္မစိုရ်လမ်း, သုမင်္ဂလာလမ်း, ၁ မှ ၁၅ လမ်း.
     * တာမွေ (Tamwe):
       - Official Wards: အရိုးကုန်း ရပ်ကွက် (Ayoe Kone - NOT အရုံးကုန်း), ကျောက်မြောင်း, မလွှကုန်း, နတ်မောက်, ပုသိမ်ညွန့်, မေတ္တာညွန့်, ဗျိုင်းရေအိုးစင်.
       - Roads: ဗညားဒလလမ်း, ကျိုက္ကဆံလမ်း, ဦးလွန်းလမ်း, သမိန်ဗရမ်းလမ်း, လေးထောင့်ကန်လမ်း, ၁၆၆ လမ်း.
     * စမ်းချောင်း (Sanchaung):
       - Wards: လင်းလွန်းတောင်, လင်းလွန်းမြောက်, ရှင်စောပု, မုန့်လက်ဆောင်းကုန်း, ဝေဠုဝန်, မင်္ဂလာ, သီရိခေမာ.
       - Roads: ဗဟိုလမ်း, ပြည်လမ်း, ဗားကရာလမ်း, ရှင်စောပုလမ်း, ပဒုမ္မာလမ်း, ကျွန်းတောလမ်း.
     * ဒဂုံမြို့သစ်များ (Dagon Townships):
       - မြောက်ဒဂုံ (၂၇ မှ ၅၁ ရပ်ကွက်၊ ပြည်ထောင်စုလမ်းမကြီး၊ ပင်လုံလမ်း၊ ဗိုလ်မှူးဗထူးလမ်း)
       - တောင်ဒဂုံ (၁၇ မှ ၂၆၊ ၅၃ မှ ၇၂၊ ၁၀၄ မှ ၁၀၈ ရပ်ကွက်၊ လှော်ကားလမ်း)
       - အရှေ့ဒဂုံ (၁ မှ ၁၆၊ ၅၂၊ ၈၈ မှ ၁၅၄ ရပ်ကွက်)
       - ဒဂုံဆိပ်ကမ်း (၆၀ မှ ၉၄ ရပ်ကွက်)
     * ရန်ကုန်မြို့တွင်း (Downtown Yangon):
       - ကျောက်တံတား, ပန်းဘဲတန်း, လသာ, လမ်းမတော်, ဗိုလ်တထောင်, ပုဇွန်တောင်, ဒဂုံ (၁ လမ်း မှ ၆၀ လမ်း၊ အနော်ရထာလမ်း၊ မဟာဗန္ဓုလလမ်း၊ ကုန်သည်လမ်း၊ ပန်းဆိုးတန်းလမ်း၊ ဗိုလ်ချုပ်လမ်း၊ ရွှေဘုံသာလမ်း၊ စဉ့်အိုးတန်းလမ်း).
     * အခြား ရန်ကုန်မြို့နယ်များ:
       - ကမာရွတ် (လှည်းတန်း), ဗဟန်း (ရွှေတောင်ကြား, ဆရာစံ), လှိုင် (၁ မှ ၁၆ ရပ်ကွက်), မရမ်းကုန်း (ပါရမီ, သမိုင်း), အင်းစိန်, မင်္ဂလာဒုံ, လှိုင်သာယာ, ရွှေပြည်သာ, သင်္ဃန်းကျွန်း (သုဝဏ္ဏ), သာကေတ, ဒေါပုံ, ရန်ကင်း, သန်လျင်, ဒလ.
   - မန္တလေးမြို့ (Mandalay Grid Cross Streets & Township Auto-Resolution):
     Mandalay follows a strict perpendicular numbering grid. When a customer provides cross-street coordinates (e.g., '55x24', '42x25', '78x30', '35x78', '၈၄ x ၃၈', '၅၈ x ၇၃', '၁၁၀ x ၆၂'), determine the township from the East-West street number and ALWAYS include the township in the address:
     * 1st to 26th Street (၁ မှ ၂၆ လမ်း အထိ) -> 'အောင်မြေသာစံ' (Aungmyethazan)
       - Examples: '55x24' -> 'မန္တလေး၊ အောင်မြေသာစံ၊ ၅၅ x ၂၄ လမ်း', '42x25' -> 'မန္တလေး၊ အောင်မြေသာစံ၊ ၄၂ x ၂၅ လမ်း'.
     * 27th to 35th Street (၂၇ မှ ၃၅ လမ်း အထိ) -> 'ချမ်းအေးသာစံ' (Chanayethazan)
       - Examples: '78x30' -> 'မန္တလေး၊ ချမ်းအေးသာစံ၊ ၇၈ x ၃၀ လမ်း', '30 x 78' -> 'မန္တလေး၊ ချမ်းအေးသာစံ၊ ၃၀ x ၇၈ လမ်း'.
     * 36th to 42nd Street (၃၆ မှ ၄၂ လမ်း အထိ) -> 'မဟာအောင်မြေ' (Mahaaungmye)
       - Examples: '84x38' -> 'မန္တလေး၊ မဟာအောင်မြေ၊ ၈၄ x ၃၈ လမ်း', '38 x 73' -> 'မန္တလေး၊ မဟာအောင်မြေ၊ ၃၈ x ၇၃ လမ်း'.
     * 43rd to 73rd Street (၄၃ မှ ၇၃ လမ်း အထိ) -> 'ချမ်းမြသာစည်' (Chanmyathazi)
       - Examples: '58x73' -> 'မန္တလေး၊ ချမ်းမြသာစည်၊ ၅၈ x ၇၃ လမ်း', '62 x 70' -> 'မန္တလေး၊ ချမ်းမြသာစည်၊ ၆၂ x ၇၀ လမ်း'.
     * 74th Street and above (၇၄ လမ်း နှင့် အထက်) -> 'ပြည်ကြီးတံခွန်' (Pyigyidagun)
       - Examples: '110x62' -> 'မန္တလေး၊ ပြည်ကြီးတံခွန်၊ ၁၁၀ x ၆၂ လမ်း', 'စက်မှု (၁)' -> 'မန္တလေး၊ ပြည်ကြီးတံခွန်'.
   - နေပြည်တော် (Naypyidaw):
     * ဇမ္ဗူသီရိ, ဒက္ခိဏသီရိ, ပုဗ္ဗသီရိ, ဥတ္တရသီရိ, ဇေယျာသီရိ, ပျဉ်းမနား, လယ်ဝေး, တပ်ကုန်း.
   - နယ်မြို့ကြီးများနှင့် မြို့တော်များ (Regional Capitals & Hubs):
     * ရှမ်းပြည်နယ်: တောင်ကြီး, လားရှိုး, ကလော, အောင်ပန်း, မူဆယ်, တာချီလိတ်, ကျိုင်းတုံ.
     * မွန် / ကရင် / တနင်္သာရီ: မော်လမြိုင်, မုဒုံ, သထုံ, ကျိုက်ထို, ဘားအံ, မြဝတီ, ထားဝယ်, မြိတ်, ကော့သောင်း.
     * ပဲခူးတိုင်း: ပဲခူး, ပြည်, တောင်ငူ (က, ခ, ဈ, ဘ ရပ်ကွက်များ), ညောင်လေးပင်, ဖြူး, ရေတာရှည်.
     * ဧရာဝတီတိုင်း: ပုသိမ်, ဟင်္သာတ, မြောင်းမြ, မအူပင်, ဖျာပုံ, ဓနုဖြူ.
     * မကွေး / စစ်ကိုင်း: မကွေး, ပခုက္ကူ, ချောက်, ရေနံချောင်း, မင်းဘူး, စစ်ကိုင်း, မုံရွာ, ရွှေဘို, ကလေး.
     * ကချင် / ရခိုင်: မြစ်ကြီးနား, ဗန်းမော်, စစ်တွေ, ကျောက်ဖြူ, သံတွဲ, ငပလီ.
   - အဝေးပြေးကားဂိတ်များ (Bus Terminals):
     * အောင်မင်္ဂလာ အဝေးပြေးဂိတ်, ဒဂုံဧရာ အဝေးပြေးဂိတ်.

5. Delivery Address Formatting & Delimiter Standardization (DELIVERY APP CONVENTIONS):
   In Myanmar e-commerce logistics, delivery apps (Ninja Van, BeeXprss, Royal Express) have only ONE phone number field and print the Address field on the parcel's waybill sticker:
   - Primary Phone Number:
     Put the single primary phone in "customer_phone" (e.g. "09266712266").
   - Address Delimiters by Language (CRITICAL):
     * If the address is in Burmese, ALWAYS use the Myanmar comma '၊ ' (U+104A followed by space) between address components:
       Example: "အမှတ် ၄၆၊ ခ ၃ လမ်း၊ အင်းစိန်၊ ရန်ကုန်" or "ရန်ကုန်၊ အင်းစိန်၊ ခ ၃ လမ်း၊ အမှတ် ၄၆".
       NEVER use English commas ',' for Burmese addresses!
     * If the address is in English, use English commas ', ':
       Example: "No. 46, Kha 3rd Street, Insein, Yangon".
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

        // Fix common OCR typo: [Letter]ညလမ်း -> [Letter] ၃ လမ်း (e.g. ခညလမ်း -> ခ ၃ လမ်း)
        $address = (string) preg_replace('/([က-အ])\s*ည\s*လမ်း/u', '$1 ၃ လမ်း', $address);

        // Automatically resolve Mandalay township if cross streets are given without a township
        $address = $this->resolveMandalayTownship($address);

        // Language-based delimiter normalization:
        $isBurmese = (bool) preg_match('/[\x{1000}-\x{109F}]/u', $address);
        if ($isBurmese) {
            // For Burmese addresses, convert all delimiters to Myanmar comma (၊ )
            $address = (string) preg_replace('/[,၊]+/u', '၊', $address);
            $address = (string) preg_replace('/\s*၊\s*/u', '၊ ', $address);
            $address = (string) preg_replace('/\s*၊\s*(\([^\)]+\))/u', ' $1', $address);
            $address = (string) preg_replace('/[\s၊,]+$/u', '', $address);
        } else {
            // For English addresses, enforce English comma (, )
            $address = (string) preg_replace('/[,၊]+/u', ',', $address);
            $address = (string) preg_replace('/\s*,\s*/u', ', ', $address);
            $address = (string) preg_replace('/\s*,\s*(\([^\)]+\))/u', ' $1', $address);
            $address = (string) preg_replace('/[\s,]+$/u', '', $address);
        }

        $address = (string) preg_replace('/\s+/', ' ', trim($address));
        $deliveryNotes = implode(', ', $internalNotes);

        return [
            'customer_phone' => $primaryPhone,
            'address' => $address,
            'delivery_notes' => $deliveryNotes,
        ];
    }

    /**
     * Automatically infer and insert Mandalay township for grid-based cross-street addresses (e.g. 55x24, 42x25, 78x30).
     */
    public function resolveMandalayTownship(string $address): string
    {
        $address = trim($address);
        if (empty($address)) {
            return '';
        }

        $townships = ['အောင်မြေသာစံ', 'ချမ်းအေးသာစံ', 'မဟာအောင်မြေ', 'ချမ်းမြသာစည်', 'ပြည်ကြီးတံခွန်'];
        foreach ($townships as $t) {
            if (str_contains($address, $t)) {
                return $address;
            }
        }

        $norm = $this->normalizeDigits($address);
        if (! preg_match('/(\d{1,3})\s*(?:[xX*×\/]|လမ်း?\s*(?:x|နှင့်|နဲ့)\s*လမ်း?|\s+နှင့်\s+|\s+နဲ့\s+|\s*ကြား\s*|\s*ထောင့်\s*)\s*(\d{1,3})/u', $norm, $matches)) {
            return $address;
        }

        $n1 = (int) $matches[1];
        $n2 = (int) $matches[2];

        $township = null;
        if ($n1 <= 26 || $n2 <= 26) {
            $township = 'အောင်မြေသာစံ';
        } elseif (($n1 >= 27 && $n1 <= 35) || ($n2 >= 27 && $n2 <= 35)) {
            $township = 'ချမ်းအေးသာစံ';
        } elseif (($n1 >= 36 && $n1 <= 42) || ($n2 >= 36 && $n2 <= 42)) {
            $township = 'မဟာအောင်မြေ';
        } elseif ($n1 >= 90 || $n2 >= 90) {
            $township = 'ပြည်ကြီးတံခွန်';
        } elseif (($n1 >= 43 && $n1 <= 73) || ($n2 >= 43 && $n2 <= 73)) {
            $township = 'ချမ်းမြသာစည်';
        } elseif ($n1 >= 74 || $n2 >= 74) {
            $township = 'ပြည်ကြီးတံခွန်';
        }

        if (! $township) {
            return $address;
        }

        $hasMandalay = preg_match('/(?:မန္တလေး|Mandalay)/iu', $address);
        if ($hasMandalay) {
            $clean = (string) preg_replace('/^(?:မန္တလေး|Mandalay)\s*(?:[၊,]\s*)?/u', '', $address);
            $clean = (string) preg_replace('/[,၊\s]*(?:မန္တလေး|Mandalay)\s*(?:[၊,]\s*)?/u', '', $clean);
            $clean = (string) preg_replace('/^[\s,၊]+/u', '', $clean);
            $clean = (string) preg_replace('/[\s,၊]+$/u', '', $clean);

            return "မန္တလေး၊ {$township}၊ {$clean}";
        }

        if (preg_match('/(?:ရန်ကုန်|Yangon|နေပြည်တော်|Naypyitaw|တောင်ကြီး|Taunggyi|ပဲခူး|Bago)/iu', $address)) {
            return $address;
        }

        return "မန္တလေး၊ {$township}၊ {$address}";
    }
}
