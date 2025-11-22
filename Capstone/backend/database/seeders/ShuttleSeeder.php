<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Shuttle;
use App\Models\Driver;
use App\Models\Route;

class ShuttleSeeder extends Seeder
{

    public function run(): void
    {
        $driver = Driver::first() ?? Driver::factory()->create();
        $route  = Route::first() ?? Route::factory()->create([
            'name' => 'Barangay Real - Calamba',
            'start_point' => 'Barangay Real',
            'end_point'   => 'Calamba Town Proper',
        ]);

        $shuttles = [

            //SHUTTLE BUSES
            [
                'model'     => 'ZK6122HD9',
                'capacity'  => 50,
                'plate'     => 'PT-2961',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

            [
                'model'     => 'KIA 555-21',
                'capacity'  => 50,
                'plate'     => 'NDL-2449',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

            [
                'model'     => 'KIA 555-35',
                'capacity'  => 50,
                'plate'     => 'UAG-2537',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],
            
            [
                'model'     => 'KIA 555-27',
                'capacity'  => 50,
                'plate'     => 'ABG-6499',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],
            [
                'model'     => 'KIA 555-15',
                'capacity'  => 50,
                'plate'     => 'NBI-5232',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],


            //SHUTTLE VANS
            [
                'model'     => 'TOYOTA ALC-22',
                'capacity'  => 50,
                'plate'     => 'BGT-4821',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

             [
                'model'     => 'TOYOTA ALC-21',
                'capacity'  => 50,
                'plate'     => 'DKH-7193',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

             [
                'model'     => 'TOYOTA ALC-13',
                'capacity'  => 50,
                'plate'     => 'MZN-2056',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

             [
                'model'     => 'TOYOTA ALC-28',
                'capacity'  => 50,
                'plate'     => 'PQL-6380',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],

             [
                'model'     => 'TOYOTA ALC-02',
                'capacity'  => 50,
                'plate'     => 'RWF-9447',
                'status'    => 'Active',
                'latitude'  => null,
                'longitude' => null,
            ],
        ];

        foreach ($shuttles as $shuttle) {
            Shuttle::create($shuttle);
        }
    }
}
