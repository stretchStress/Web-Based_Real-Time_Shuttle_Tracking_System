<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Report extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'type',
        'source',
        'description',
        'passenger_name',
        'company_name',
        'date',
        'reported_at',
        'trips',
        'rating',
        'plate_number',
        'driver_id',
        'shuttle_id',
        'route_id',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
        'date' => 'date',
    ];

    public function driver()
    {
        return $this->belongsTo(\App\Models\Driver::class);
    }

    public function shuttle()
    {
        return $this->belongsTo(\App\Models\Shuttle::class);
    }

    public function route()
    {
        return $this->belongsTo(\App\Models\Route::class);
    }
}
