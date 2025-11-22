<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Maintenance extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'shuttle_id',
        'technician',
        'date',
        'start_date',
        'end_date',
        'description',
        'status',
        'report_file',
    ];

    public function shuttle()
    {
        return $this->belongsTo(Shuttle::class);
    }

}
