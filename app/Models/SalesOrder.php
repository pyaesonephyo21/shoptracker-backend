<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class SalesOrder extends Model
{
    use BelongsToShop, HasFactory;
    use LogsActivity;

    protected $guarded = ['id'];

    // Disable automatic Spatie logging since we manually call logAction()
    protected static $recordEvents = [];

    protected $casts = [
        'is_deli_prepaid' => 'boolean',
        'created_at' => 'datetime',
        // Cast decimals to ensure math accuracy in PHP
        'subtotal' => 'float',
        'discount_value' => 'float',
        'delivery_fee' => 'float',
        'courier_service_fee' => 'float',
        'extra_fee' => 'float',
        'paid_amount' => 'float',
    ];

    public function items()
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    public function getTargetCollectionAttribute(): float
    {
        if (! $this->courier_id) {
            return (float) $this->customer_grand_total;
        }

        if ($this->money_collected_by === 'seller') {
            return (float) ($this->is_deli_prepaid
                ? $this->customer_grand_total
                : (($this->subtotal - $this->discount_total) + $this->extra_fee));
        }

        // COD: Courier collects from customer and remits net revenue to seller
        return (float) $this->net_revenue;
    }

    public function getBalanceAttribute(): float
    {
        return (float) ($this->target_collection - $this->paid_amount);
    }

    // FIX: Relationship must point to Courier, not Item
    public function courier()
    {
        return $this->belongsTo(Courier::class);
    }

    // Helper to log changes cleanly
    public function logAction($action, $details = [])
    {
        // Wrap Spatie's activity log to maintain backwards compatibility
        // with all existing Service classes that call this method.
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
            ->logOnly(['status', 'payment_status', 'delivery_fee', 'discount_total', 'paid_amount', 'net_revenue'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    public function payments()
    {
        return $this->hasMany(SalesOrderPayment::class);
    }

    public function scopeFilter($query, array $filters)
    {
        $query->when($filters['status'] ?? null, function ($query, $status) {
            $query->where('status', $status);
        })->when($filters['settlement_status'] ?? null, function ($query, $settlementStatus) {
            $query->where('payment_status', $settlementStatus);
        })->when($filters['payment_method'] ?? null, function ($query, $paymentMethod) {
            $query->whereHas('payments', function ($pq) use ($paymentMethod) {
                $pq->where('payment_method', $paymentMethod)
                    ->whereRaw('sales_order_payments.id = (select max(id) from sales_order_payments as sop where sop.sales_order_id = sales_orders.id)');
            });
        })->when($filters['search'] ?? null, function ($query, $search) {
            $query->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%");
            });
        })->when($filters['start_date'] ?? null, function ($query, $startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        })->when($filters['end_date'] ?? null, function ($query, $endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        });
    }
}
