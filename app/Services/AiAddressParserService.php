<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class AiAddressParserService
{
    /**
     * Parse raw Myanmar chat message text or image using AI.
     *
     * @return array<string, mixed>
     */
    public function parse(string $rawText = '', ?string $imageBase64 = null, ?string $imageMimeType = null): array
    {
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

        if (empty(trim($rawText)) && empty($imageBase64)) {
            return [
                'success' => false,
                'reason' => 'empty_input',
                'message' => 'Please provide message text or an image to parse.',
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

        $systemPrompt = <<<'PROMPT'
You are an expert AI assistant specialized in parsing Myanmar e-commerce customer information from chat messages, text, screenshots of chat conversations (e.g. Facebook Messenger, Viber, Telegram), delivery slips, waybills, and handwritten delivery notes into clean, structured customer and delivery details.

If an image or screenshot is provided:
- Carefully perform OCR to read all text, including Myanmar (Burmese) script and English.
- Locate sender/recipient information. Distinguish between seller/shop information and buyer/recipient (customer) information. Extract the BUYER / RECIPIENT customer details.
- Identify the dedicated customer info bubble (e.g., Name, Address, Phone block sent by customer).

CRITICAL OCR & GEOGRAPHY ACCURACY GUIDELINES FOR BURMESE SCRIPT:
1. Myanmar Ward (ရပ်ကွက်) Systems:
   Myanmar addresses use three distinct ward naming systems:
   - Numbered Wards (ဂဏန်း ရပ်ကွက်): E.g., ၁ ရပ်ကွက်, ၂ ရပ်ကွက်, ၁၀ ရပ်ကွက်, ၁၁ ရပ်ကွက်, ၁၂ ရပ်ကွက်.
     * On low-resolution chat screenshots, two consecutive Burmese ones ('၁၁') can visually resemble the consonants 'ဘ' or 'သ'. Carefully distinguish the dual circular strokes of '၁၁' from a single 'ဘ' or 'သ'.
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

4. Delivery Remarks / Notes:
   - ONLY include specific logistics constraints or customer delivery requests (e.g., "ကျောင်းဖွင့်ရက်မှပို့ပါ", "မနက်ပိုင်းပဲဆက်ပါ", "ရုံးချိန်ပို့ပေးပါ", "မပို့ခင်ဖုန်းဆက်ပါ", "ကားဂိတ်ချိန်းပါ").
   - CRITICAL: NEVER extract payment methods (e.g., "COD", "Cod ရယူမည်", "Cod ရလား", "ငွေလွှဲ"), order intent (e.g., "တစုံယူမယ်နော်", "မှာမယ်နော်"), or conversational greetings into delivery notes.
   - If no specific logistics constraints are present, leave delivery_notes as empty string ("").

Return ONLY a valid JSON object without markdown code blocks (no ```json fences) in this exact schema:
{
  "customer_name": "...",
  "customer_phone": "...",
  "address": "...",
  "delivery_notes": ""
}
PROMPT;

        $promptText = trim($rawText);
        if (empty($promptText) && ! empty($imageBase64)) {
            $promptText = 'Extract customer name, phone number, delivery address, and delivery notes from this photo or screenshot into the structured JSON schema.';
        }

        try {
            $content = '';
            $source = '';

            // 1. Try Native Google Gemini Models First (Rotates on 429/quota, 503, or failure)
            if (! empty($geminiKey)) {
                $geminiModels = [
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
                        $http = Http::connectTimeout(3)->timeout(12)
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

                        Log::warning("Gemini model {$gModel} failed (status: {$geminiResponse->status()}). Trying next model...", [
                            'body' => $geminiResponse->body(),
                        ]);
                    } catch (Throwable $e) {
                        Log::warning("Gemini connection error on {$gModel}: ".$e->getMessage());

                        $msg = strtolower($e->getMessage());
                        if (str_contains($msg, 'could not resolve host') || str_contains($msg, 'curl error 6')) {
                            break;
                        }

                        continue;
                    }
                }
            }

            // 2. Try OpenRouter Fallback Chain (Works globally without VPN)
            if (empty($content) && ! empty($openRouterKey)) {
                $primaryModel = (string) config('services.openrouter.model', 'nvidia/nemotron-3.5-super-vl:free');
                $modelChain = array_unique([
                    $primaryModel,
                    'nvidia/nemotron-3.5-super-vl:free',
                    'google/gemma-4-26b-a4b-it:free',
                    'google/gemma-4-31b-it:free',
                ]);

                if (! empty($imageBase64)) {
                    $userContent = [];
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
                        $orResponse = Http::connectTimeout(3)->timeout(12)
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

                        Log::warning("OpenRouter model {$currentModel} failed (status: {$orResponse->status()}). Trying next...");
                    } catch (Throwable $e) {
                        Log::warning("OpenRouter error on {$currentModel}: ".$e->getMessage());
                    }
                }
            }

            // 3. Final Check: Did ANY API succeed?
            if (empty($content)) {
                Log::error('All AI APIs in the fallback chain failed.');

                return [
                    'success' => false,
                    'reason' => 'api_error',
                    'message' => 'AI Service temporarily unavailable. Using smart local parser.',
                ];
            }

            // 4. Process the successful response
            $cleanJson = trim($content);
            if (str_starts_with($cleanJson, '```')) {
                $cleanJson = (string) preg_replace('/^```(?:json)?\s*/i', '', $cleanJson);
                $cleanJson = (string) preg_replace('/\s*```$/', '', $cleanJson);
                $cleanJson = trim($cleanJson);
            }

            $parsed = json_decode($cleanJson, true);

            if (! is_array($parsed)) {
                Log::warning('AI returned non-JSON content', ['source' => $source, 'content' => $content]);

                return [
                    'success' => false,
                    'reason' => 'invalid_ai_response',
                    'message' => 'Could not parse AI response.',
                ];
            }

            // Normalize phone number digits if Burmese digits were returned
            $phone = trim((string) ($parsed['customer_phone'] ?? ''));
            $phone = strtr($phone, [
                '၀' => '0', '၁' => '1', '၂' => '2', '၃' => '3', '၄' => '4',
                '၅' => '5', '၆' => '6', '၇' => '7', '၈' => '8', '၉' => '9',
            ]);

            // Extract individual phone numbers, clean and standardize them
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
                $phone = implode(', ', $cleanedPhones);
            } else {
                $phone = (string) preg_replace('/[^\d+,\/\s-]/', '', $phone);
            }

            $addr = trim((string) ($parsed['address'] ?? ''));

            $notes = trim((string) ($parsed['delivery_notes'] ?? ''));
            if (preg_match('/^(?:cod|ငွေချေ|ငွေလွှဲ|တန်ဆာခ|ပစ္စည်းရောက်ငွေချေ)(?:\s*(?:ရယူမည်|ရလား|ယူမည်|ပါ|နော်|နှင့်|ဖြင့်|ရှင်းပြီး|ရှင်းပေးပါ))?$/iu', $notes) ||
                preg_match('/^(?:တစုံယူမယ်နော်|တစ်စုံယူမယ်နော်|၁စုံယူမယ်နော်|မှာမယ်နော်)$/u', $notes)) {
                $notes = '';
            }

            return [
                'success' => true,
                'data' => [
                    'customer_name' => trim((string) ($parsed['customer_name'] ?? '')),
                    'customer_phone' => $phone,
                    'address' => $addr,
                    'delivery_address' => $addr,
                    'delivery_notes' => $notes,
                ],
            ];

        } catch (Throwable $e) {
            Log::error('AI address parsing exception: '.$e->getMessage());

            return [
                'success' => false,
                'reason' => 'exception',
                'message' => 'AI parsing error: '.$e->getMessage(),
            ];
        }
    }
}
