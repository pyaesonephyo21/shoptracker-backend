<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Scopes\ShopScope; // Ensure you have this scope or use the closure method below

class PurchaseOrder extends Model
{
    use HasFactory;

    // 1. Allow Mass Assignment
    // This lets us do PurchaseOrder::create($data) safely
    protected $guarded = ['id'];

    protected $casts = [
        'total_goods_cost' => 'decimal:2',
        'grand_total' => 'decimal:2',
        // 'created_at' casts are automatic
    ];

    protected $appends = ['supplier_name'];

    public function getSupplierNameAttribute()
    {
        return $this->supplier_id ? $this->supplier->name : $this->local_shop_name;
    }

    /**
     * The "Magic" Boot Method
     * automatically adds shop_id when creating
     * and filters by shop_id when reading.
     */
    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check() && auth()->user()->shop_id) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });

        static::creating(function ($po) {
            if (auth()->check() && auth()->user()->shop_id) {
                $po->shop_id = auth()->user()->shop_id;
            }
        });
    }

    // ==========================
    // RELATIONSHIPS
    // ==========================

    // This is what allows $po->items() to work
    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
