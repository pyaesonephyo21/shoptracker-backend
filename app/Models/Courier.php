<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Courier extends Model
{
    use BelongsToShop, HasFactory;

    protected $guarded = ['id'];

    public function SalesOrder()
    {
        return $this->hasMany(SalesOrder::class);
    }
}
