<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_name' => $this->batch_name,
            'status' => $this->status,

            // 1. TRANSFORM: Return the Name, not just the ID
            // We use the null coalescing operator in case the supplier was deleted
            'supplier_name' => $this->supplier ? $this->supplier->name : 'Unknown Supplier',
            'supplier_id' => $this->supplier_id, // Keep ID for linking if needed

            // 2. CASTING: Ensure numbers are actual numbers, not strings
            'exchange_rate' => (float) $this->exchange_rate,

            // Costs breakdown
            'total_goods_cost' => (float) $this->total_goods_cost,
            'supplier_fee' => (float) $this->supplier_fee,
            'cargo_fee' => (float) $this->cargo_fee,
            'local_deli_fee' => (float) $this->local_deli_fee,

            // Totals
            'grand_total' => (float) $this->grand_total,

            // Payment tracking
            'payment_status' => $this->payment_status,
            'paid_amount' => (float) $this->paid_amount,

            'note' => $this->note,

            // Standard timestamps
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,

            'items' => $this->whenLoaded('items', function () {
                return $this->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'quantity' => $item->quantity,
                        'original_cost' => (float) $item->original_cost,
                        'unit_cost' => (float) $item->unit_cost,
                        'line_total' => (float) $item->line_total,
                        // Include Product Name specifically for the UI list
                        'product' => [
                            'id' => $item->product_id,
                            'name' => $item->product ? $item->product->name : 'Unknown Product',
                            'sku' => $item->product ? $item->product->sku : null,
                        ]
                    ];
                });
            }),
        ];
    }
}
