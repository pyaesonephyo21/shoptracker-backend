<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesOrderPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'sales_order_id',
        'amount',
        'payment_method',
    ];

    public function salesOrder()
    {
        return $this->belongsTo(SalesOrder::class);
    }
}
