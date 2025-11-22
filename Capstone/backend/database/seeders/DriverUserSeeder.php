<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Driver;
use Illuminate\Support\Facades\Hash;

class DriverUserSeeder extends Seeder
{
    public function run()
    {
        $drivers = [
            [
                'first_name'    => 'Francis',
                'last_name'     => 'Absalon',
                'email'         => 'francisabsalon@gmail.com',
                'cellphone_num' => '0905-3545-878',
                'password'      => 'Francis@246',
            ],
            [
                'first_name' => 'Victor',
                'last_name'  => 'Basilan',
                'email'      => 'victorbasilan@gmail.com',
                'cellphone_num' => '0907-4176-116',
                'password'   => 'Victor_567',
            ],
            [
                'first_name' => 'Larry',
                'last_name'  => 'Arcala',
                'email'      => 'larryarcala@gmail.com',
                'cellphone_num' => '0915-482-3791',
                'password'   => 'Larry@123',
            ],
            [
                'first_name' => 'Raymond',
                'last_name'  => 'Cruz',
                'email'      => 'reymond.cruz@gmail.com',
                'cellphone_num' => '0998-445-3302',
                'password'   => '_Raymond789',
            ],
            [
                'first_name' => 'Edgardo',
                'last_name'  => 'Fajardo',
                'email'      => 'edgardo.fajardo.drv@gmail.com',
                'cellphone_num' => '0956-701-4420',
                'password'   => '@Edgardo369',
            ],
            [
                'first_name' => 'Roi Vicent',
                'last_name'  => 'Lapuz',
                'email'      => 'rv.lapuz@gmail.com',
                'cellphone_num' => '0939-550-2184',
                'password'   => 'Roy@vin012',
            ],
            [
                'first_name' => 'Rosauro',
                'last_name'  => 'Layson',
                'email'      => 'rosauro.layson@yahoo.com',
                'cellphone_num' => '0921-883-5576',
                'password'   => 'Rosauro-963',
            ],
            [
                'first_name' => 'Jenel',
                'last_name'  => 'Pahayahay',
                'email'      => 'jenel.pahayahay@yahoo.com',
                'cellphone_num' => '0947-612-3308',
                'password'   => 'Jenel*852',
            ],
            [
                'first_name' => 'Narciso',
                'last_name'  => 'Panday',
                'email'      => 'narciso.panday@gmail.com',
                'cellphone_num' => '0906-742-1150',
                'password'   => '@741Narciso',
            ],
            [
                'first_name' => 'Leodegario',
                'last_name'  => 'Pinote',
                'email'      => 'leodegario.pinote@gmail.com',
                'cellphone_num' => '0922-883-5576',
                'password'   => 'Leode@654',
            ],
            [
                'first_name' => 'Ilan',
                'last_name'  => 'Pantalla',
                'email'      => 'ilan.pantalla@gmail.com',
                'cellphone_num' => '0923-883-5577', // Changed from '0922-883-5576'
                'password'   => 'Ilan.147',
            ],
            [
                'first_name' => 'Froiland',
                'last_name'  => 'Potenciano',
                'email'      => 'froiland.potenciano@gmail.com',
                'cellphone_num' => '0924-883-5578', // Changed from '0922-883-5576'
                'password'   => 'Froi034*',
            ],
            [
                'first_name' => 'Jesson',
                'last_name'  => 'Santillan',
                'email'      => 'jesson.santillan@gmail.com',
                'cellphone_num' => '0925-883-5579', // Changed from '0922-883-5576'
                'password'   => 'Jesson_357',
            ],
            [
                'first_name' => 'Ferdinand',
                'last_name'  => 'Mendoza',
                'email'      => 'ferdinand.mendoza@gmail.com',
                'cellphone_num' => '0926-883-5580', // Changed from '0922-883-5576'
                'password'   => 'Ferdi_159',
            ],
            [
                'first_name' => 'Liberato',
                'last_name'  => 'Odoño',
                'email'      => 'liberato.odono@gmail.com',
                'cellphone_num' => '0927-883-5581', // Changed from '0922-883-5576'
                'password'   => 'Liberato@201',
            ],
            
        ];

        foreach ($drivers as $d) {
            // Check if user already exists to avoid duplicates
            $user = User::firstOrCreate(
                ['email' => $d['email']],
                [
                    'first_name' => $d['first_name'],
                    'last_name'  => $d['last_name'],
                    'password'   => Hash::make($d['password']),
                    'role'       => 'driver',
                ]
            );

            // Check if driver already exists to avoid duplicates
            Driver::firstOrCreate(
                ['cellphone_num' => $d['cellphone_num']],
                [
                    'user_id'       => $user->id,
                    'first_name'    => $user->first_name,
                    'last_name'     => $user->last_name,
                    'email'         => $user->email,
                ]
            );
        }
    }
}
