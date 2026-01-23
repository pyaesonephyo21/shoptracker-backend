<?php

namespace App\Models;

use App\Models\SalesOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Courier extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    // 1. Auto-assign Shop ID
    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check()) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });

        static::creating(function ($model) {
            if (auth()->check()) {
                $model->shop_id = auth()->user()->shop_id;
            }
        });
    }

    public function SalesOrder()
    {
        return $this->hasMany(SalesOrder::class);
    }
}
