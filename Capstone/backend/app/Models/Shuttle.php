<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shuttle extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'model',
        'capacity',
        'plate',
        'status',
        'latitude',
        'longitude',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}
