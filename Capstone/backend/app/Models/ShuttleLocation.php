<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShuttleLocation extends Model
{
    public $timestamps = true;

    protected $fillable = [
        'shuttle_id',
        'latitude',
        'longitude',
        'updated_at'
    ];

    public function shuttle(): BelongsTo
    {
        return $this->belongsTo(Shuttle::class);
    }
}
