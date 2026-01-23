<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    // 1. The Global Scope (Security)
    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check() && auth()->user()->shop_id) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });

        static::creating(function ($log) {
            if (auth()->check() && auth()->user()->shop_id) {
                $log->shop_id = auth()->user()->shop_id;
            }
        });
    }

    // 2. Polymorphic Relationship (The "Reference")
    // This allows the log to point to EITHER a PurchaseOrder OR a SalesOrder
    public function reference()
    {
        return $this->morphTo();
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
