<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use BelongsToShop, HasFactory;

    protected $guarded = ['id'];

    // 2. Relationship
    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
