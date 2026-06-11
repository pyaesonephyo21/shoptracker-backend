<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class Category extends Model
{
    use HasFactory, BelongsToShop;

    protected $guarded = ['id'];

    // 2. Relationship
    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
