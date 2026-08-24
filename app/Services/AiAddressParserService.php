<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAddressParserService
{
    /**
     * Parse raw Myanmar chat message text using AI.
     */
    public function parse(string $rawText): array
    {
        $geminiKey = config('services.gemini.api_key');
        $geminiProxy = config('services.gemini.proxy');
        $openRouterKey = config('services.openrouter.api_key');

        if (empty($openRouterKey) && empty($geminiKey)) {
            return [
                'success' => false,
                'reason' => 'no_api_key',
                'message' => 'No AI API Key is configured on the server.',
            ];
        }

        $systemPrompt = <<<'PROMPT'
You are an expert AI assistant specialized in parsing Myanmar e-commerce customer messages (e.g. from Facebook Messenger, Viber, Telegram, SMS) into clean, structured customer and delivery details.

Your goals:
1. Customer Name:
   - Extract the real person's name.
   - Preserve genuine name honorifics if present (e.g., "ကို", "မ", "မောင်", "ဒေါ်", "ဦး", "Dr.").
   - Strip conversational vocatives & prefixes (e.g., "အမရေ", "အစ်မ", "အကို", "ညီမလေး", "မင်္ဂလာပါ", "Name:", "Acc Name:", "Customer Name:").
   - Strip Burmese polite ending particles (e.g., "ပါ", "ပါရှင့်", "ပါခင်ဗျာ", "ပါဗျ", "ပါနော်", "ပါ့မယ်", "ရှင့်", "ခင်ဗျာ", "ကတော့").
   - Never mistake ordered items (e.g. "T-shirt 2 ထည်", "Lipstick", "Dress M size") for the customer name.

2. Customer Phone:
   - Extract Myanmar phone numbers.
   - Normalize Burmese digits (၀-၉) to standard English digits (0-9).
   - Format cleanly as standard Myanmar phone format (e.g., "09XXXXXXXXX").
   - If there are multiple phone numbers, extract all of them separated by a comma (e.g., "09772775937, 09776573573").
   - If a 2nd phone number is missing 09 (e.g. "09772775937 / 776573573"), restore the full 09 prefix.

3. Delivery Address:
   - Extract full address including city, township, street name, house/building number, ward, landmarks, school/office buildings, and Highway Express gates (ကားဂိတ် / အဝေးပြေးဂိတ်).
   - Format with neat Burmese commas (၊) or spaces between components for readability.
   - Example: "သာကေတ စက်မှုဇုန် မြန်မာ့ဂုဏ်ရည်လမ်း Metro IT Center" -> "သာကေတ စက်မှုဇုန်၊ မြန်မာ့ဂုဏ်ရည်လမ်း၊ Metro IT Center".

4. Delivery Remarks / Notes:
   - Extract any specific delivery constraints or requests (e.g., "ကျောင်းဖွင့်ရက်မှပို့ပါ", "မနက်ပိုင်းပဲဆက်ပါ", "ရုံးချိန်ပို့ပေးပါ", "မပို့ခင်ဖုန်းဆက်ပါ", "COD ပို့ပေးပါ", "ကားခ တန်ဆာခ ရှင်းပြီး"). If none, leave as empty string.

Return ONLY a valid JSON object without markdown code blocks (no ```json fences) in this exact schema:
{
  "customer_name": "...",
  "customer_phone": "...",
  "address": "...",
  "delivery_notes": "..."
}
PROMPT;

        try {
            $content = '';
            $source = '';

            // 1. Try Native Google Gemini Models First (Rotates on 429/quota or failure)
            if (! empty($geminiKey)) {
                $geminiModels = [
                    'gemini-flash-latest',
                    'gemini-2.5-flash',
                    'gemini-3.5-flash',
                ];

                foreach ($geminiModels as $gModel) {
                    try {
                        $http = Http::connectTimeout(3)->timeout(10)->withHeaders([
                            'Content-Type' => 'application/json',
                        ]);

                        if (! empty($geminiProxy)) {
                            $http->withOptions(['proxy' => $geminiProxy]);
                        }

                        $geminiResponse = $http->post("https://generativelanguage.googleapis.com/v1beta/models/{$gModel}:generateContent?key={$geminiKey}", [
                            'system_instruction' => [
                                'parts' => ['text' => $systemPrompt],
                            ],
                            'contents' => [
                                [
                                    'role' => 'user',
                                    'parts' => [['text' => $rawText]],
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
                                'temperature' => 0.1,
                                'responseMimeType' => 'application/json',
                            ],
                        ]);

                        if ($geminiResponse->successful()) {
                            $geminiData = $geminiResponse->json();
                            $content = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? '';
                            if (! empty($content)) {
                                $source = "gemini:{$gModel}";
                                break;
                            }
                        }

                        Log::warning("Gemini model {$gModel} failed (status: {$geminiResponse->status()}). Trying next model...", [
                            'body' => $geminiResponse->body(),
                        ]);
                    } catch (\Throwable $e) {
                        Log::warning("Gemini connection error on {$gModel}: ".$e->getMessage().'. Likely VPN disconnected or timeout.');
                        // If connection timed out, break immediately to OpenRouter to save user from waiting
                        break;
                    }
                }
            }

            // 2. Try OpenRouter Fallback Chain (Works globally without VPN)
            if (empty($content) && ! empty($openRouterKey)) {
                $primaryModel = config('services.openrouter.model', 'meta-llama/llama-3.1-8b-instruct:free');
                $modelChain = array_unique([
                    $primaryModel,
                    'google/gemma-2-9b-it:free',
                    'microsoft/phi-3-mini-128k-instruct:free',
                    'openrouter/free',
                ]);

                foreach ($modelChain as $currentModel) {
                    try {
                        $orResponse = Http::timeout(15)
                            ->withHeaders([
                                'Authorization' => "Bearer {$openRouterKey}",
                                'HTTP-Referer' => config('app.url', 'http://localhost:8080'),
                                'X-Title' => 'ShopTracker',
                                'Content-Type' => 'application/json',
                            ])
                            ->post('https://openrouter.ai/api/v1/chat/completions', [
                                'model' => $currentModel,
                                'messages' => [
                                    ['role' => 'system', 'content' => $systemPrompt],
                                    ['role' => 'user', 'content' => $rawText],
                                ],
                                'temperature' => 0.1,
                            ]);

                        if ($orResponse->successful()) {
                            $responseData = $orResponse->json();
                            $content = $responseData['choices'][0]['message']['content'] ?? '';
                            if (! empty($content)) {
                                $source = "openrouter:{$currentModel}";
                                break;
                            }
                        }

                        Log::warning("OpenRouter model {$currentModel} failed (status: {$orResponse->status()}). Trying next...");
                    } catch (\Throwable $e) {
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
                $cleanJson = preg_replace('/^```(?:json)?\s*/i', '', $cleanJson);
                $cleanJson = preg_replace('/\s*```$/', '', $cleanJson);
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
            $phone = trim($parsed['customer_phone'] ?? '');
            $phone = strtr($phone, [
                '၀' => '0', '၁' => '1', '၂' => '2', '၃' => '3', '၄' => '4',
                '၅' => '5', '၆' => '6', '၇' => '7', '၈' => '8', '၉' => '9',
            ]);

            // Extract individual phone numbers, clean and standardize them
            preg_match_all('/(?:\+?95\s*9|0\s*9)[\s\-\.]*(?:\d[\s\-\.]*){7,9}\b/', $phone, $phoneMatches);
            if (! empty($phoneMatches[0])) {
                $cleanedPhones = [];
                foreach ($phoneMatches[0] as $rawPh) {
                    $cleanPh = preg_replace('/[\s\-\.\+]/', '', $rawPh);
                    if (str_starts_with($cleanPh, '959')) {
                        $cleanPh = '09'.substr($cleanPh, 3);
                    } elseif (! str_starts_with($cleanPh, '09') && str_starts_with($cleanPh, '9')) {
                        $cleanPh = '0'.$cleanPh;
                    }
                    if (! in_array($cleanPh, $cleanedPhones)) {
                        $cleanedPhones[] = $cleanPh;
                    }
                }
                $phone = implode(', ', $cleanedPhones);
            } else {
                $phone = preg_replace('/[^\d+,\/\s-]/', '', $phone);
            }

            return [
                'success' => true,
                'data' => [
                    'customer_name' => trim($parsed['customer_name'] ?? ''),
                    'customer_phone' => $phone,
                    'address' => trim($parsed['address'] ?? ''),
                    'delivery_notes' => trim($parsed['delivery_notes'] ?? ''),
                ],
            ];

        } catch (\Exception $e) {
            Log::error('AI address parsing exception: '.$e->getMessage());

            return [
                'success' => false,
                'reason' => 'exception',
                'message' => 'AI parsing error: '.$e->getMessage(),
            ];
        }
    }
}
