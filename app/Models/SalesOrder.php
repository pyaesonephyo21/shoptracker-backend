<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Support\Facades\Auth;

class SalesOrder extends Model
{
    use LogsActivity;
    use HasFactory, BelongsToShop;
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
                'details' => $details
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
}
