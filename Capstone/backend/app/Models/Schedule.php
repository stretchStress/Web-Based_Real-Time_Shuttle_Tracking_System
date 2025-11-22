<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Schedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'driver_id',
        'route_id',
        'shuttle_id',
        'date',
        'day',
        'time',
        'time_in',
        'time_out',
        'status',
    ];

    protected $casts = [
        'date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function shuttle()
    {
        return $this->belongsTo(Shuttle::class);
    }

    public function clients()
    {
        return $this->belongsToMany(Client::class, 'client_schedule')->withTimestamps();
    }
}
