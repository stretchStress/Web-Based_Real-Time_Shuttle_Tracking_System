<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'company_id',
        'first_name',
        'last_name',
        'email',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function schedules()
    {
        return $this->belongsToMany(Schedule::class, 'client_schedule')->withTimestamps();
    }
}