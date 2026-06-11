<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class Expense extends Model
{
    use HasFactory, BelongsToShop;

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
