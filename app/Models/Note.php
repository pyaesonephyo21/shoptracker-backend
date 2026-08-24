<?php

namespace App\Models;

use App\Traits\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    use BelongsToShop, HasFactory;

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
