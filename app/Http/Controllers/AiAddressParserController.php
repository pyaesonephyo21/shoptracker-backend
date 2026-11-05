<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\ParseAiAddressRequest;
use App\Services\AiAddressParserService;
use Illuminate\Http\JsonResponse;

class AiAddressParserController extends Controller
{
    /**
     * Parse raw Myanmar chat message text or image using AI.
     */
    public function parse(ParseAiAddressRequest $request, AiAddressParserService $parserService): JsonResponse
    {
        $validated = $request->validated();
        $rawText = (string) ($validated['text'] ?? '');
        $imageBase64 = null;
        $imageMimeType = null;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $imageBase64 = base64_encode((string) file_get_contents($file->getRealPath()));
            $imageMimeType = $file->getMimeType() ?: 'image/jpeg';
        } elseif (! empty($validated['image_base64'])) {
            $rawBase64 = (string) $validated['image_base64'];
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $rawBase64, $matches)) {
                $imageMimeType = $matches[1];
                $imageBase64 = $matches[2];
            } else {
                $imageBase64 = $rawBase64;
                $imageMimeType = (string) ($validated['image_mime'] ?? 'image/jpeg');
            }
        }

        $result = $parserService->parse($rawText, $imageBase64, $imageMimeType);

        return response()->json($result);
    }
}
