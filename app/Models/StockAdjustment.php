<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasFactory;
    protected $guarded = ['id'];

    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check() && auth()->user()->shop_id) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });

        static::creating(function ($adj) {
            if (auth()->check() && auth()->user()->shop_id) {
                $adj->shop_id = auth()->user()->shop_id;
            }
            // Automatically record WHO did it
            if (auth()->check()) {
                $adj->user_id = auth()->id();
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
