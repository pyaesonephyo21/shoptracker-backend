<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory;
    protected $guarded = ['id'];

    // Shop Scope (Copy the booted method from Product/Order)
    protected static function booted()
    {
        static::addGlobalScope('shop', function ($builder) {
            if (auth()->check() && auth()->user()->shop_id) {
                $builder->where('shop_id', auth()->user()->shop_id);
            }
        });
        static::creating(function ($model) {
            if (auth()->check() && auth()->user()->shop_id) {
                $model->shop_id = auth()->user()->shop_id;
            }
        });
    }
}
