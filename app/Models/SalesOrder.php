<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesOrder extends Model
{
    use HasFactory;
    protected $guarded = ['id'];

    protected $casts = [
        'audit_log' => 'array',
        'is_deli_prepaid' => 'boolean',
        'created_at' => 'datetime',
        // Cast decimals to ensure math accuracy in PHP
        'subtotal' => 'float',
        'discount_value' => 'float',
        'delivery_fee' => 'float',
        'courier_service_fee' => 'float',
        'paid_amount' => 'float',
    ];

    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check() && auth()->user()->shop_id) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });

        static::creating(function ($order) {
            if (auth()->check() && auth()->user()->shop_id) {
                $order->shop_id = auth()->user()->shop_id;
            }
        });
    }

    public function items()
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    // FIX: Relationship must point to Courier, not Item
    public function courier()
    {
        return $this->belongsTo(Courier::class);
    }

    // Helper to log changes cleanly
    public function logAction($action, $details = [])
    {
        $log = $this->audit_log ?? [];
        $log[] = [
            'action' => $action,
            'by' => auth()->user()->name ?? 'System',
            'at' => now()->toIso8601String(),
            'details' => $details
        ];
        $this->audit_log = $log;
        $this->saveQuietly();
    }
}
