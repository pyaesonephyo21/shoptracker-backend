<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class StockAdjustment extends Model
{
    use BelongsToShop, HasFactory;

    protected $guarded = ['id'];

    protected static function booted()
    {
        static::creating(function ($adj) {
            // Automatically record WHO did it
            if (Auth::check()) {
                $adj->user_id = Auth::id();
            }
        });
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
