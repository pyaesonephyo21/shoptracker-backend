<?php

namespace App\Services;

use App\Models\InventoryLog;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\StockAdjustment;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class StockAdjustmentService
{
    /**
     * Adjust stock for a product, log the adjustment, and update product stock.
     */
    public function adjustStock(int $productVariantId, int $quantity, string $reason, ?string $note = null): StockAdjustment
    {
        return DB::transaction(function () use ($productVariantId, $quantity, $reason, $note) {
            $variant = ProductVariant::with('product')->lockForUpdate()->findOrFail($productVariantId);
            $shopId = $variant->product->shop_id;

            $newStockLevel = $variant->stock_quantity + $quantity;

            if ($newStockLevel < 0) {
                throw new Exception("Stock cannot be negative. Current stock: {$variant->stock_quantity}");
            }

            $totalCost = 0;

            if ($quantity > 0) {
                // Find latest batch for this variant to copy costs
                $latestBatch = ProductBatch::where('product_variant_id', $variant->id)->latest('created_at')->first();
                $unitCost = $latestBatch ? $latestBatch->unit_cost : 0;
                $retailPrice = $latestBatch ? $latestBatch->retail_price : $variant->effective_retail_price;

                $totalCost = $quantity * $unitCost;

                // Create a new batch for the added stock
                ProductBatch::create([
                    'shop_id' => $shopId,
                    'product_variant_id' => $variant->id,
                    'reference_type' => StockAdjustment::class, // Will set reference_id after creating adjustment
                    'reference_id' => 0,
                    'initial_quantity' => $quantity,
                    'remaining_quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'retail_price' => $retailPrice,
                ]);
            } elseif ($quantity < 0) {
                // Deplete active batches using FIFO
                $remainingQtyNeeded = abs($quantity);
                $activeBatches = ProductBatch::where('product_variant_id', $variant->id)
                    ->where('remaining_quantity', '>', 0)
                    ->orderBy('created_at', 'asc')
                    ->get();

                foreach ($activeBatches as $batch) {
                    if ($remainingQtyNeeded <= 0) {
                        break;
                    }

                    $takeQty = min($batch->remaining_quantity, $remainingQtyNeeded);
                    $totalCost += ($takeQty * $batch->unit_cost);

                    $remainingQtyNeeded -= $takeQty;
                    $batch->decrement('remaining_quantity', $takeQty);
                }
            }

            // 1. Create StockAdjustment record
            $adjustment = StockAdjustment::create([
                'shop_id' => $shopId,
                'product_variant_id' => $variant->id,
                'user_id' => Auth::id() ?? 1,
                'quantity' => $quantity,
                'total_cost' => $totalCost,
                'reason' => $reason,
                'note' => $note,
            ]);

            // Update the batch reference if it was a positive adjustment
            if ($quantity > 0) {
                ProductBatch::where('reference_type', StockAdjustment::class)
                    ->where('reference_id', 0)
                    ->where('product_variant_id', $variant->id)
                    ->latest('id')
                    ->first()
                    ->update(['reference_id' => $adjustment->id]);
            }

            // 2. Log in InventoryLog
            InventoryLog::create([
                'product_variant_id' => $variant->id,
                'quantity_change' => $quantity,
                'new_stock_level' => $newStockLevel,
                'reason' => $reason,
                'reference_type' => StockAdjustment::class,
                'reference_id' => $adjustment->id,
                'note' => $note,
            ]);

            // 3. Update Product stock
            $variant->update([
                'stock_quantity' => $newStockLevel,
            ]);

            return $adjustment;
        });
    }
}
