<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAddressParserController extends Controller
{
    /**
     * Parse raw Myanmar chat message text using OpenRouter AI.
     */
    public function parse(Request $request)
    {
        $request->validate([
            'text' => 'required|string|max:3000',
        ]);

        $apiKey = config('services.openrouter.api_key');
        if (empty($apiKey)) {
            return response()->json([
                'success' => false,
                'reason' => 'no_api_key',
                'message' => 'OpenRouter API Key is not configured on the server.',
            ], 200);
        }

        $model = config('services.openrouter.model', 'google/gemma-4-26b-a4b-it:free');
        $rawText = $request->input('text');

        $systemPrompt = <<<PROMPT
You are an expert AI assistant specialized in parsing Myanmar e-commerce customer messages (e.g. from Facebook Messenger, Viber, Telegram, SMS) into clean, structured customer and delivery details.

Your goals:
1. Customer Name:
   - Extract the real person's name.
   - Strip prefixes/labels (e.g., "Name", "Name -", "နာမည်", "အမည်", "Acc Name", "Customer Name").
   - Strip Burmese polite ending particles and conversational linkers (e.g., "ပါ", "ပါရှင့်", "ပါခင်ဗျာ", "ပါဗျ", "ပါနော်", "ပါ့မယ်", "ရှင့်", "ခင်ဗျာ", "ကတော့").
   - Example: "Name သွန်းသီရိဆွေပါ" -> "သွန်းသီရိဆွေ".

2. Customer Phone:
   - Extract Myanmar phone numbers.
   - Normalize Burmese digits (၀-၉) to standard English digits (0-9).
   - Format cleanly as standard Myanmar phone format (e.g., "09XXXXXXXXX").

3. Delivery Address:
   - Extract full address including township, street name, house/building number, ward, landmarks, and school/office buildings.
   - Example: "သာကေတ စက်မှုဇုန် မြန်မာ့ဂုဏ်ရည်လမ်း Metro IT Center" -> "သာကေတ စက်မှုဇုန်၊ မြန်မာ့ဂုဏ်ရည်လမ်း၊ Metro IT Center".

4. Delivery Remarks / Notes:
   - Extract any specific delivery constraints or requests (e.g., "ကျောင်းဖွင့်ရက်မှပို့ပါ", "မနက်ပိုင်းပဲဆက်ပါ", "ရုံးချိန်ပို့ပေးပါ"). If none, leave as empty string.

Return ONLY a valid JSON object without markdown code blocks (no ```json fences) in this exact schema:
{
  "customer_name": "...",
  "customer_phone": "...",
  "address": "...",
  "delivery_notes": "..."
}
PROMPT;

        try {
            $response = Http::timeout(25)
                ->withHeaders([
                    'Authorization' => "Bearer {$apiKey}",
                    'HTTP-Referer' => config('app.url', 'http://localhost:8080'),
                    'X-Title' => 'ShopTracker',
                    'Content-Type' => 'application/json',
                ])
                ->post('https://openrouter.ai/api/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $rawText],
                    ],
                    'temperature' => 0.1,
                ]);

            // If the configured model endpoint is 404 or fails, attempt one fallback to openrouter/free
            if (!$response->successful() && $model !== 'openrouter/free') {
                Log::warning("OpenRouter model {$model} failed ({$response->status()}), falling back to openrouter/free");
                $response = Http::timeout(25)
                    ->withHeaders([
                        'Authorization' => "Bearer {$apiKey}",
                        'HTTP-Referer' => config('app.url', 'http://localhost:8080'),
                        'X-Title' => 'ShopTracker',
                        'Content-Type' => 'application/json',
                    ])
                    ->post('https://openrouter.ai/api/v1/chat/completions', [
                        'model' => 'openrouter/free',
                        'messages' => [
                            ['role' => 'system', 'content' => $systemPrompt],
                            ['role' => 'user', 'content' => $rawText],
                        ],
                        'temperature' => 0.1,
                    ]);
            }

            if (!$response->successful()) {
                Log::warning('OpenRouter API returned error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'success' => false,
                    'reason' => 'api_error',
                    'message' => 'AI Service temporarily unavailable. Using smart local parser.',
                ], 200);
            }

            $responseData = $response->json();
            $content = $responseData['choices'][0]['message']['content'] ?? '';

            // Clean any potential markdown code blocks if the model returned them
            $cleanJson = trim($content);
            if (str_starts_with($cleanJson, '```')) {
                $cleanJson = preg_replace('/^```(?:json)?\s*/i', '', $cleanJson);
                $cleanJson = preg_replace('/\s*```$/', '', $cleanJson);
                $cleanJson = trim($cleanJson);
            }

            $parsed = json_decode($cleanJson, true);

            if (!is_array($parsed)) {
                Log::warning('OpenRouter returned non-JSON content', ['content' => $content]);
                return response()->json([
                    'success' => false,
                    'reason' => 'invalid_ai_response',
                    'message' => 'Could not parse AI response.',
                ], 200);
            }

            // Normalize phone number digits if Burmese digits were returned
            $phone = trim($parsed['customer_phone'] ?? '');
            $phone = strtr($phone, [
                '၀' => '0', '၁' => '1', '၂' => '2', '၃' => '3', '၄' => '4',
                '၅' => '5', '၆' => '6', '၇' => '7', '၈' => '8', '၉' => '9',
            ]);
            $phone = preg_replace('/[^\d+]/', '', $phone);

            return response()->json([
                'success' => true,
                'data' => [
                    'customer_name' => trim($parsed['customer_name'] ?? ''),
                    'customer_phone' => $phone,
                    'address' => trim($parsed['address'] ?? ''),
                    'delivery_notes' => trim($parsed['delivery_notes'] ?? ''),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('OpenRouter address parsing exception: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'reason' => 'exception',
                'message' => 'AI parsing error: ' . $e->getMessage(),
            ], 200);
        }
    }
}
