<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Support\Facades\Auth;
use App\Traits\BelongsToShop;

class PurchaseOrder extends Model
{
    use HasFactory, BelongsToShop, LogsActivity;

    // 1. Allow Mass Assignment
    // This lets us do PurchaseOrder::create($data) safely
    protected $guarded = ['id'];

    // Disable automatic Spatie logging since we manually call logAction()
    protected static $recordEvents = [];

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
        'is_paid' => 'boolean',
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
        // Wrap Spatie's activity log to maintain backwards compatibility
        activity()
            ->performedOn($this)
            ->causedBy(Auth::user())
            ->withProperties([
                'by' => Auth::user()->name ?? 'System',
                'details' => $details
            ])
            ->log($action);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'payment_status', 'total_goods_cost', 'total_discount', 'paid_amount', 'grand_total'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
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
