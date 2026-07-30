<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductBatch extends Model
{
    use \App\Traits\BelongsToShop;

    protected $guarded = ['id'];

    protected $casts = [
        'unit_cost' => 'float',
        'retail_price' => 'float',
    ];

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class)->withTrashed();
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }
}
