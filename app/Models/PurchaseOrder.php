<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use App\Traits\BelongsToShop;

class PurchaseOrder extends Model
{
    use HasFactory, BelongsToShop;

    // 1. Allow Mass Assignment
    // This lets us do PurchaseOrder::create($data) safely
    protected $guarded = ['id'];

    protected $casts = [
        'exchange_rate' => 'float',
        'total_goods_cost' => 'float',
        'foreign_deli_fee' => 'float',
        'total_discount' => 'float',
        'supplier_fee_percentage' => 'float',
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
