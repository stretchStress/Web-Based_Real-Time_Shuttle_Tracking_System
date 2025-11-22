<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Client;
use App\Models\Company;
use Illuminate\Support\Facades\Hash;

class ClientUserSeeder extends Seeder
{
    public function run()
    {
        $faker = fake();

        $companies = Company::all();

        foreach ($companies as $company) {
            for ($i = 1; $i <= 25; $i++) {

                $user = User::create([
                    'first_name' => $faker->firstName(),
                    'last_name'  => $faker->lastName(),
                    'email'      => $faker->unique()->safeEmail(),
                    'password'   => Hash::make('Client123'),
                    'role'       => 'client',
                ]);

                Client::create([
                    'user_id'    => $user->id,
                    'company_id' => $company->id,
                    'first_name' => $user->first_name,
                    'last_name'  => $user->last_name,
                    'email'      => $user->email,
                ]);
            }

            $this->command->info("Created 25 clients for {$company->name}");
        }
    }
}
