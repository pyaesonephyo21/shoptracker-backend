<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Product extends Model implements HasMedia
{
    use BelongsToShop, HasFactory, InteractsWithMedia;

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
        $query->when($filters['search'] ?? null, function ($query, $search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('variants', function ($vq) use ($search) {
                        $vq->where('sku', 'like', "%{$search}%");
                    });
            });
        })->when($filters['type'] ?? null, function ($query, $type) {
            $query->where('type', $type);
        })->when($filters['category_id'] ?? null, function ($query, $categoryId) {
            if ($categoryId === 'uncategorized') {
                $query->whereNull('category_id');
            } else {
                $query->where('category_id', $categoryId);
            }
        })->when($filters['status'] ?? null, function ($query, $status) {
            if ($status === 'active') {
                $query->where('is_active', true);
            } elseif ($status === 'archived') {
                $query->where('is_active', false);
            }
        })->when($filters['filter'] ?? null, function ($query, $filter) {
            if ($filter === 'low_stock') {
                $query->where(function ($q) {
                    $q->selectRaw('coalesce(sum(stock_quantity), 0)')
                        ->from('product_variants')
                        ->whereColumn('product_variants.product_id', 'products.id')
                        ->whereNull('product_variants.deleted_at');
                }, '<=', 5);
            }
        });
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
    public function registerMediaConversions(?Media $media = null): void
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
