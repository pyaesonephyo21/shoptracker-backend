<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
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

    // 2. Relationship
    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
