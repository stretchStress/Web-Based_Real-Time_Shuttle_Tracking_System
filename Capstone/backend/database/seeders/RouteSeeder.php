<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Route;

class RouteSeeder extends Seeder
{
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('routes')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $routes = [
            [
                'company' => 'Katolec Philippines Corporation',
                'name' => 'Katolec Route Balibago',
                'direction' => 'Incoming',
                'embarked' => '54WW+F2C, Calamba, 4027 Laguna, Philippines',
                'embarked_lat' => 14.194538,
                'embarked_lng' => 121.165787,
                'disembarked' => '56QM+CVW, Santa Rosa, Laguna, Philippines',
                'disembarked_lat' => 14.307848,
                'disembarked_lng' => 121.105249,
                'pickup_points' => json_encode(["Balibago Complex", "SM Santa Rosa"]),
                'pickup_coords' => json_encode([
                    ["lat" => 14.293558492418692, "lng" => 121.1006243960681]
                ]),
                'status' => 'Active',
            ],
            [
                'company' => 'Nidec Philippines Corporation',
                'name' => 'Nidec (LTAI) Route SM Calamba',
                'direction' => 'Incoming',
                'embarked' => '54WW+F2C, Calamba, 4027 Laguna, Philippines',
                'embarked_lat' => 14.194538,
                'embarked_lng' => 121.165787,
                'disembarked' => '54XH+C84, Calamba, Laguna, Philippines',
                'disembarked_lat' => 14.212118,
                'disembarked_lng' => 121.164049,
                'pickup_points' => json_encode(["SM Calamba"]),
                'pickup_coords' => json_encode([
                    ["lat" => 14.20383340832793, "lng" => 121.15383094214843]
                ]),
                'status' => 'Active',
            ],
            [
                'company' => 'EHS Lens Philippines Inc.',
                'name' => 'ELPH (FPIP) Route Paciano',
                'direction' => 'Incoming',
                'embarked' => '54WW+F2C, Calamba, 4027 Laguna, Philippines',
                'embarked_lat' => 14.194538,
                'embarked_lng' => 121.165787,
                'disembarked' => '4233+4VF, Santo Tomas, Batangas',
                'disembarked_lat' => 14.082204,
                'disembarked_lng' => 121.146831,
                'pickup_points' => json_encode(["Paciano", "Checkpoint"]),
                'pickup_coords' => json_encode([
                    ["lat" => 14.215080614223712, "lng" => 121.13837921890578]
                ]),
                'status' => 'Active',
            ],
            [
                'company' => 'EHS Lens Philippines Inc.',
                'name' => 'ELPH (FPIP) Route Los Baños',
                'direction' => 'Incoming',
                'embarked' => '54WW+F2C, Calamba, 4027 Laguna, Philippines',
                'embarked_lat' => 14.194538,
                'embarked_lng' => 121.165787,
                'disembarked' => '4233+4VF, Santo Tomas, Batangas',
                'disembarked_lat' => 14.082204,
                'disembarked_lng' => 121.146831,
                'pickup_points' => json_encode(["Los Baños Crossing"]),
                'pickup_coords' => json_encode([
                    ["lat" => 14.17736343283997, "lng" => 121.22179878190119]
                ]),
                'status' => 'Active',
            ],
            [
                'company' => 'Yazaki-Torres Manufacturing Inc.',
                'name' => 'Yazaki-Torres Route Calamba',
                'direction' => 'Incoming',
                'embarked' => '54WW+F2C, Calamba, 4027 Laguna, Philippines',
                'embarked_lat' => 14.194538,
                'embarked_lng' => 121.165787,
                'disembarked' => '52V6+HJ8, Calamba, Laguna, Philippines',
                'disembarked_lat' => 14.136228,
                'disembarked_lng' => 121.120173,
                'pickup_points' => json_encode(["CPIP Gate", "iMall Canlubang"]),
                'pickup_coords' => json_encode([
                    ["lat" => 14.20643311695444, "lng" => 121.15524619387357]
                ]),
                'status' => 'Active',
            ],
        ];

        foreach ($routes as $r) {
            Route::create($r);
        }
    }
}
