<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use BelongsToShop, HasFactory;

    protected $fillable = [
        'shop_id',
        'title',
        'amount',
        'incurred_at',
        'category',
        'note',
    ];

    protected $casts = [
        'incurred_at' => 'date',
        'amount' => 'decimal:2',
    ];
}
