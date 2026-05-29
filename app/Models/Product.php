<?php

namespace App\Models;

use Spatie\MediaLibrary\HasMedia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Spatie\MediaLibrary\InteractsWithMedia;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model implements HasMedia
{
    use HasFactory, InteractsWithMedia;

    protected $guarded = [];

    protected $appends = ['image_url'];

    /**
     * The "The Boot Method"
     * This runs automatically every time this Model is used.
     */
    protected static function booted()
    {
        // If a user is logged in, AUTOMATICALLY filter by their shop_id
        static::addGlobalScope('shop', function (Builder $builder) {
            if (Auth::check()) {
                $builder->where('shop_id', Auth::user()->shop_id);
            }
        });

        // When CREATING a product, AUTOMATICALLY set the shop_id
        static::creating(function ($product) {
            if (Auth::check()) {
                $product->shop_id = Auth::user()->shop_id;
            }
        });
    }

    /**
     * Scope a query to filter products.
     * Usage: Product::filter($request->all())->get();
     */
    public function scopeFilter($query, array $filters)
    {
        // 1. Search Filter
        if (isset($filters['search']) && $filters['search']) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        // 2. Type Filter
        if (isset($filters['type']) && $filters['type']) {
            $query->where('type', $filters['type']);
        }
        // 3. You can easily add more here later (e.g. Price Range)
        // if (isset($filters['min_price'])) { ... }

        return $query;
    }

    public function getImageUrlAttribute()
    {
        return $this->getFirstMediaUrl('products');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class);
    }

    // Optional: Auto-resize images when uploaded
    public function registerMediaConversions(\Spatie\MediaLibrary\MediaCollections\Models\Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->width(150)
            ->height(150)
            ->sharpen(10);

        $this->addMediaConversion('app_view')
            ->width(800)
            ->height(800);
    }
    public function batches()
    {
        return $this->hasMany(ProductBatch::class);
    }
}
