<?php

namespace App\Traits;

use App\Models\Shop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * @mixin Model
 *
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
        static::addGlobalScope('shop', function ($builder) {
            if (Auth::check() && Auth::user()->shop_id) {
                $builder->where(app(static::class)->getTable().'.shop_id', Auth::user()->shop_id);
            }
        });

        static::creating(function ($model) {
            if (empty($model->shop_id) && Auth::check() && Auth::user()->shop_id) {
                $model->shop_id = Auth::user()->shop_id;
            }
        });
    }

    /**
     * Define the relationship to the Shop model.
     */
    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }
}
