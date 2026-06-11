<?php

namespace App\Models;

use Spatie\MediaLibrary\HasMedia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Spatie\MediaLibrary\InteractsWithMedia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToShop;

class Product extends Model implements HasMedia
{
    use HasFactory, InteractsWithMedia, BelongsToShop;

    protected $guarded = [];

    protected $casts = [
        'variant_options' => 'array',
        'is_active' => 'boolean',
    ];

    protected $appends = ['image_url'];

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
                  ->orWhereHas('variants', function($q) use ($search) {
                      $q->where('sku', 'like', "%{$search}%");
                  });
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

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
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
}
