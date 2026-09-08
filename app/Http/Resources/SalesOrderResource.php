<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $calculatedProfit = $this->net_revenue - $this->total_cost - ($this->return_cost ?? 0);

        return [
            'id' => $this->id,
            'date' => $this->created_at->format('Y-m-d H:i'),

            'customer' => [
                'name' => $this->customer_name ?? 'Guest',
                'phone' => $this->customer_phone,
                'address' => $this->delivery_address,
            ],

            'status' => ucfirst($this->status), // "Completed", "Pending"

            'financials' => [
                'subtotal' => (float) $this->subtotal,
                'discount' => (float) $this->discount_total,
                'discount_type' => $this->discount_type,
                'discount_value' => (float) $this->discount_value,
                'discount_reason' => $this->discount_reason,

                'paid_amount' => (float) $this->paid_amount,
                'payment_status' => $this->payment_status,
                'target_collection' => (float) $this->target_collection,
                'balance' => (float) $this->balance,

                'grand_total' => (float) $this->customer_grand_total,
                'net_revenue' => (float) $this->net_revenue,
                'total_cost' => (float) $this->total_cost,
                'return_cost' => (float) $this->return_cost,
                'profit' => $this->when($request->user()->isOwner(), (float) $calculatedProfit),
            ],

            'delivery' => [
                // Relationship fixed in Model, so this works now
                'courier_name' => $this->courier ? $this->courier->name : 'Self/Pickup',
                'tracking' => $this->tracking_number,
                'fee' => (int) $this->delivery_fee,
                'courier_service_fee' => $this->courier ? $this->courier->default_service_fee : 0,
                'is_prepaid' => (bool) $this->is_deli_prepaid,
                'collected_by' => $this->money_collected_by,
                'settlement_status' => $this->settlement_status,
            ],

            'note' => $this->note,

            'items' => $this->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_name' => $item->product ? $item->product->name : 'Unknown Product',
                    'quantity' => (int) $item->quantity,
                    'price' => (float) $item->unit_price,
                    'total' => (float) $item->line_total,
                    'discount_amount' => $item->discount_amount,
                    'discount_type' => $item->discount_type,
                    'discount_value' => $item->discount_value,
                    'discount_reason' => $item->discount_reason,
                ];
            }),
            'activities' => $this->activities,
        ];
    }
}
