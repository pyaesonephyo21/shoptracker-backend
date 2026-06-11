<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class SalesOrder extends Model
{
    use HasFactory, BelongsToShop;
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
            'by' => Auth::user()->name ?? 'System',
            'at' => now()->toIso8601String(),
            'details' => $details
        ];
        $this->audit_log = $log;
        $this->saveQuietly();
    }

    public function payments()
    {
        return $this->hasMany(SalesOrderPayment::class);
    }
}
