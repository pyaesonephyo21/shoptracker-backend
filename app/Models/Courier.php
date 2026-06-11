<?php

namespace App\Models;

use App\Models\SalesOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToShop;

class Courier extends Model
{
    use HasFactory, BelongsToShop;

    protected $guarded = ['id'];

    public function SalesOrder()
    {
        return $this->hasMany(SalesOrder::class);
    }
}
