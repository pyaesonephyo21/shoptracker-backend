<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class InventoryLog extends Model
{
    use HasFactory, BelongsToShop;

    protected $guarded = ['id'];

    // 2. Polymorphic Relationship (The "Reference")
    // This allows the log to point to EITHER a PurchaseOrder OR a SalesOrder
    public function reference()
    {
        return $this->morphTo();
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class)->withTrashed();
    }
}
