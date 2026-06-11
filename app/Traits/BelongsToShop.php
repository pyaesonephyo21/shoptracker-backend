<?php

namespace App\Traits;

use App\Models\Shop;
use Illuminate\Support\Facades\Auth;

/**
 * @mixin \Illuminate\Database\Eloquent\Model
 * @method static void addGlobalScope(string $scope, \Closure $callback)
 * @method static void creating(\Closure $callback)
 */
trait BelongsToShop
{
    /**
     * Boot the trait to add the global scope and creating listener.
     */
    protected static function bootBelongsToShop()
    {
        // Only apply if we have an authenticated user with a shop_id
        if (Auth::check() && Auth::user()->shop_id) {
            
            // 1. Automatically filter queries by shop_id
            static::addGlobalScope('shop', function ($builder) {
                // Use getTable() to prevent ambiguous column errors in joins
                $builder->where(app(static::class)->getTable() . '.shop_id', Auth::user()->shop_id);
            });

            // 2. Automatically set shop_id when creating a new record
            static::creating(function ($model) {
                if (empty($model->shop_id)) {
                    $model->shop_id = Auth::user()->shop_id;
                }
            });
        }
    }

    /**
     * Define the relationship to the Shop model.
     */
    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }
}
