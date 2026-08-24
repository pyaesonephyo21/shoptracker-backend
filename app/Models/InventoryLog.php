<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use BelongsToShop, HasFactory;

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
