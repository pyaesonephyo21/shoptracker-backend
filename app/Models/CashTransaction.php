<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class CashTransaction extends Model
{
    use HasFactory, BelongsToShop;

    protected $fillable = [
        'shop_id',
        'amount',
        'type',
        'reference_type',
        'reference_id',
        'description',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function reference()
    {
        return $this->morphTo();
    }
}
