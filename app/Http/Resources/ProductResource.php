<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku,

            // Format Money: Send as integer (10000) or formatted string ("10,000 MMK")?
            // Apps usually prefer raw numbers for math, formatted strings for display.
            'price' => [
                'retail' => (float) $this->retail_price,
                'cost' => $this->when($request->user()->isOwner(), (float) $this->base_cost), // SECURE!
            ],

            // The Image (Using the accessor we made)
            'image' => $this->image_url,

            // Relationships (Only load if we asked for them)
            'category' => new CategoryResource($this->whenLoaded('category')),

            'inventory_logs' => $this->whenLoaded('inventoryLogs'),

            'stock_quantity' => (int) $this->stock_quantity,
            'pending_stock' => (int) $this->pending_stock,
            'status' => $this->stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
        ];
    }
}
