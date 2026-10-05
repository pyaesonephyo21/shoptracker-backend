<?php

declare(strict_types=1);

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
    public function adjustStock(
        int $productVariantId,
        int $quantity,
        string $reason,
        ?string $note = null,
        ?string $batchPricingMode = 'default',
        ?int $selectedBatchId = null,
        ?float $unitCost = null,
        ?float $retailPrice = null,
        bool $updateVariantRetailPrice = false
    ): StockAdjustment {
        return DB::transaction(function () use (
            $productVariantId,
            $quantity,
            $reason,
            $note,
            $batchPricingMode,
            $selectedBatchId,
            $unitCost,
            $retailPrice,
            $updateVariantRetailPrice
        ) {
            $variant = ProductVariant::with('product')->lockForUpdate()->findOrFail($productVariantId);
            $shopId = $variant->product->shop_id;

            $newStockLevel = $variant->stock_quantity + $quantity;

            if ($newStockLevel < 0) {
                throw new Exception("Stock cannot be negative. Current stock: {$variant->stock_quantity}");
            }

            $totalCost = 0.0;
            $resolvedUnitCost = 0.0;
            $resolvedRetailPrice = null;
            $shouldCreateNewBatch = false;

            if ($quantity > 0) {
                $deficit = $variant->stock_quantity < 0 ? abs($variant->stock_quantity) : 0;
                $deduction = min($deficit, $quantity);
                $netRemainingToAdd = $quantity - $deduction;

                if ($batchPricingMode === 'existing' && $selectedBatchId) {
                    // Top up selected existing batch
                    $targetBatch = ProductBatch::where('product_variant_id', $variant->id)
                        ->lockForUpdate()
                        ->findOrFail($selectedBatchId);

                    $targetBatch->increment('initial_quantity', $quantity);
                    $targetBatch->increment('remaining_quantity', $netRemainingToAdd);

                    $resolvedUnitCost = (float) $targetBatch->unit_cost;
                    $resolvedRetailPrice = $targetBatch->retail_price !== null
                        ? (float) $targetBatch->retail_price
                        : (float) $variant->effective_retail_price;
                } elseif ($batchPricingMode === 'new') {
                    // Create a brand new batch with custom prices
                    $latestBatch = ProductBatch::where('product_variant_id', $variant->id)->latest('created_at')->first();

                    $resolvedUnitCost = ($unitCost !== null && $unitCost >= 0)
                        ? (float) $unitCost
                        : ($latestBatch ? (float) $latestBatch->unit_cost : 0.0);

                    $resolvedRetailPrice = ($retailPrice !== null && $retailPrice >= 0)
                        ? (float) $retailPrice
                        : ($latestBatch && $latestBatch->retail_price !== null
                            ? (float) $latestBatch->retail_price
                            : (float) $variant->effective_retail_price);

                    $shouldCreateNewBatch = true;
                } else {
                    // Default mode: top up latest batch, or create initial batch if none exists
                    $targetBatch = ProductBatch::where('product_variant_id', $variant->id)
                        ->latest('created_at')
                        ->lockForUpdate()
                        ->first();

                    if ($targetBatch) {
                        $targetBatch->increment('initial_quantity', $quantity);
                        $targetBatch->increment('remaining_quantity', $netRemainingToAdd);

                        $resolvedUnitCost = (float) $targetBatch->unit_cost;
                        $resolvedRetailPrice = $targetBatch->retail_price !== null
                            ? (float) $targetBatch->retail_price
                            : (float) $variant->effective_retail_price;
                    } else {
                        $resolvedUnitCost = 0.0;
                        $resolvedRetailPrice = (float) $variant->effective_retail_price;
                        $shouldCreateNewBatch = true;
                    }
                }

                $totalCost = $quantity * $resolvedUnitCost;
            } elseif ($quantity < 0) {
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

            // 2. Only create a brand new batch if requested ('new' mode or initial stock)
            if ($quantity > 0 && $shouldCreateNewBatch) {
                $deficit = $variant->stock_quantity < 0 ? abs($variant->stock_quantity) : 0;
                $deduction = min($deficit, $quantity);
                $batchRemainingQty = $quantity - $deduction;

                ProductBatch::create([
                    'shop_id' => $shopId,
                    'product_variant_id' => $variant->id,
                    'reference_type' => StockAdjustment::class,
                    'reference_id' => $adjustment->id,
                    'initial_quantity' => $quantity,
                    'remaining_quantity' => $batchRemainingQty,
                    'unit_cost' => $resolvedUnitCost,
                    'retail_price' => $resolvedRetailPrice,
                ]);
            }

            // 3. Log in InventoryLog
            InventoryLog::create([
                'shop_id' => $shopId,
                'product_variant_id' => $variant->id,
                'quantity_change' => $quantity,
                'new_stock_level' => $newStockLevel,
                'reason' => $reason,
                'reference_type' => StockAdjustment::class,
                'reference_id' => $adjustment->id,
                'note' => $note,
            ]);

            // 4. Update Product Variant
            $variantUpdates = [
                'stock_quantity' => $newStockLevel,
            ];

            if ($quantity > 0 && ($updateVariantRetailPrice || $variant->retail_price === null) && $resolvedRetailPrice !== null && $resolvedRetailPrice > 0) {
                $variantUpdates['retail_price'] = $resolvedRetailPrice;
            }

            $variant->update($variantUpdates);

            return $adjustment;
        });
    }
}
