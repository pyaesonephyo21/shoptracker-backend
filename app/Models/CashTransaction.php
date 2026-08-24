<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashTransaction extends Model
{
    use BelongsToShop, HasFactory;

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
