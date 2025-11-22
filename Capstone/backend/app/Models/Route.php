<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Route extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'company',
        'name',
        'direction',
        'embarked',
        'pickup_points',
        'pickup_times',
        'disembarked',
        'status',
        'embarked_lat',
        'embarked_lng',
        'disembarked_lat',
        'disembarked_lng',
        'pickup_coords',
    ];

    protected $casts = [
        'pickup_points' => 'array',
        'pickup_times' => 'array',
        'pickup_coords' => 'array',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
