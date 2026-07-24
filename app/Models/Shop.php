<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shop extends Model
{
    protected $guarded = []; // Allow mass assignment

    protected $casts = [
        'settings' => 'array', // Auto-convert JSON to Array
    ];

    public function users()
    {
        return $this->belongsToMany(User::class, 'shop_user');
    }

    public function paymentMethods()
    {
        return $this->hasMany(PaymentMethod::class);
    }
}
