<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class Supplier extends Model
{
    use HasFactory, BelongsToShop;
    protected $guarded = ['id'];


}
