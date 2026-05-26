<?php

namespace App\Services;

use App\Models\Product;
use App\Models\InventoryLog;
use App\Models\StockAdjustment;
use Illuminate\Support\Facades\DB;
use Exception;

class StockAdjustmentService
{
    /**
     * Adjust stock for a product, log the adjustment, and update product stock.
     */
    public function adjustStock(int $productId, int $quantity, string $reason, ?string $note = null): StockAdjustment
    {
        return DB::transaction(function () use ($productId, $quantity, $reason, $note) {
            $product = Product::lockForUpdate()->findOrFail($productId);

            $newStockLevel = $product->stock_quantity + $quantity;

            if ($newStockLevel < 0) {
                throw new Exception("Stock cannot be negative. Current stock: {$product->stock_quantity}");
            }

            // 1. Create StockAdjustment record
            $adjustment = StockAdjustment::create([
                'product_id' => $product->id,
                'quantity' => $quantity,
                'reason' => $reason,
                'note' => $note,
            ]);

            // 2. Log in InventoryLog
            InventoryLog::create([
                'product_id' => $product->id,
                'quantity_change' => $quantity,
                'new_stock_level' => $newStockLevel,
                'reason' => $reason,
                'reference_type' => StockAdjustment::class,
                'reference_id' => $adjustment->id,
                'note' => $note,
            ]);

            // 3. Update Product stock
            $product->update([
                'stock_quantity' => $newStockLevel
            ]);

            return $adjustment;
        });
    }
}
