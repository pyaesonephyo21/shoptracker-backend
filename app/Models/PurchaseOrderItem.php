<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrderItem extends Model
{
    use HasFactory;

    // Allow everything to be filled (controlled by Controller validation)
    protected $guarded = ['id'];

    // ==========================
    // RELATIONSHIPS
    // ==========================

    // Allows $item->product->increment(...) to work
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Link back to the parent order
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
