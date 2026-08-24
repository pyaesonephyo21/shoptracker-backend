<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class PurchaseOrder extends Model
{
    use BelongsToShop, HasFactory, LogsActivity;

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
                'details' => $details,
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

    public function scopeFilter($query, array $filters)
    {
        $query->when($filters['search'] ?? null, function ($query, $search) {
            $query->where(function ($q) use ($search) {
                $q->where('batch_name', 'like', "%{$search}%")
                    ->orWhere('shop_name', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($sq) use ($search) {
                        $sq->where('name', 'like', "%{$search}%");
                    });
            });
        })->when($filters['status'] ?? null, function ($query, $status) {
            $query->where('status', $status);
        })->when($filters['payment_status'] ?? null, function ($query, $paymentStatus) {
            $query->where('payment_status', $paymentStatus);
        })->when($filters['start_date'] ?? null, function ($query, $startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        })->when($filters['end_date'] ?? null, function ($query, $endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        });
    }
}
