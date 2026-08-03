<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToShop;

class Note extends Model
{
    use HasFactory, BelongsToShop;

    protected $fillable = [
        'shop_id',
        'user_id',
        'type',
        'title',
        'customer_name',
        'customer_phone',
        'content',
        'is_pinned',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
    ];

    /**
     * Relationship to the user who created the note.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
