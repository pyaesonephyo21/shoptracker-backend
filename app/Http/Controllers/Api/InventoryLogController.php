<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryLog;
use Illuminate\Http\Request;

class InventoryLogController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryLog::with(['product']);

        // Filter: See history for just one specific product
        // Usage: /inventory-logs?product_id=1
        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        return $query->latest()->paginate(20);
    }
}
