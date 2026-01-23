<?php

namespace App\Services;

use App\Models\StockAdjustment;
use App\Models\InventoryLog;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class StockAdjustmentService
{
    public function adjust(array $data)
    {
        return DB::transaction(function () use ($data) {
            // 1. Create the Adjustment Record
            $adjustment = StockAdjustment::create($data);

            // 2. Update the Product Stock
            // If quantity is -1, it subtracts. If +1, it adds.
            $product = Product::findOrFail($data['product_id']);
            $product->increment('stock_quantity', $data['quantity']);

            // 3. Create the Inventory Log (The Paper Trail)
            InventoryLog::create([
                'shop_id' => $adjustment->shop_id,
                'product_id' => $product->id,
                'quantity_change' => $data['quantity'],
                'new_stock_level' => $product->stock_quantity,
                'reason' => "adjustment_{$data['reason']}", // e.g. adjustment_damage
                'reference_type' => StockAdjustment::class,
                'reference_id' => $adjustment->id,
                'note' => $data['note']
            ]);

            return $adjustment;
        });
    }
}
