<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'contact_email',
        'contact_number',
        'address',
        'city',
        'province',
        'postal_code',
        'contract_start',
        'contract_end',
        'status', // active, inactive, terminated
    ];

    // Relationships
    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function routes()
    {
        return $this->hasMany(Route::class);
    }
}
