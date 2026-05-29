<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class PurchaseOrder extends Model
{
    use HasFactory;

    // 1. Allow Mass Assignment
    // This lets us do PurchaseOrder::create($data) safely
    protected $guarded = ['id'];

    protected $casts = [
        'exchange_rate' => 'float',
        'total_goods_cost' => 'float',
        'supplier_fee' => 'float',
        'cargo_fee' => 'float',
        'local_deli_fee' => 'float',
        'grand_total' => 'float',
        'paid_amount' => 'float',
        'adjustment_amount' => 'float',
        'audit_log' => 'array',
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
            if (Auth::check() && Auth::user()->shop_id) {
                $builder->where('shop_id', Auth::user()->shop_id);
            }
        });

        static::creating(function ($po) {
            if (Auth::check() && Auth::user()->shop_id) {
                $po->shop_id = Auth::user()->shop_id;
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

    public function logAction($action, $details = [])
    {
        $log = $this->audit_log ?? [];
        $log[] = [
            'action' => $action,
            'by' => Auth::user()->name ?? 'System',
            'at' => now()->toIso8601String(),
            'details' => $details
        ];
        $this->audit_log = $log;
        $this->saveQuietly();
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
