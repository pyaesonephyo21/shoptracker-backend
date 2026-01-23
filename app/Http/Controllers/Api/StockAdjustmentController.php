<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Services\StockAdjustmentService;
use App\Http\Requests\StockAdjustmentRequest;

class StockAdjustmentController extends Controller
{
    public function __construct(protected StockAdjustmentService $service) {}

    public function store(StockAdjustmentRequest $request)
    {
        $adjustment = $this->service->adjust($request->validated());

        return response()->json([
            'message' => 'Stock adjusted successfully',
            'data' => $adjustment
        ], 201);
    }
}
