<?php

namespace App\Http\Controllers;

use App\Services\AiAddressParserService;
use Illuminate\Http\Request;

class AiAddressParserController extends Controller
{
    /**
     * Parse raw Myanmar chat message text using AI.
     */
    public function parse(Request $request, AiAddressParserService $parserService)
    {
        $request->validate([
            'text' => 'required|string|max:3000',
        ]);

        $rawText = $request->input('text');
        $result = $parserService->parse($rawText);

        return response()->json($result, 200);
    }
}
