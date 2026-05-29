<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesOrderItem extends Model
{
    use HasFactory;
    protected $guarded = ['id'];

    protected $casts = [
        'batch_breakdown' => 'array',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
