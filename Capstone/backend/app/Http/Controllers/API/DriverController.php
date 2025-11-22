<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Driver;

class DriverController extends Controller
{
    public function index()
    {
        return Driver::whereNull('deleted_at')
            ->whereHas('user', function ($query) {
                $query->whereNull('deleted_at');
            })
            ->with('user')
            ->get();
    }
}
