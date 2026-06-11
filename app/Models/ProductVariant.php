<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'attributes' => 'array',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function batches()
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class);
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function salesOrderItems()
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    /**
     * Fallback to product retail price if variant retail price is not set
     */
    public function getEffectiveRetailPriceAttribute()
    {
        return $this->retail_price ?? $this->product?->retail_price ?? 0;
    }
}
