<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Company;

class CompanySeeder extends Seeder
{
    public function run()
    {
        $companies = [
            [
                'name' => 'Katolec Philippines Corporation',
                'contact_email' => 'contact@katolec.ph',
                'contact_number' => '+63 900 000 0000',
                'address' => 'Calamba, Laguna',
                'city' => 'Calamba',
                'province' => 'Laguna',
                'postal_code' => '4027',
                'contract_start' => now()->toDateString(),
                'contract_end' => now()->addYear()->toDateString(),
                'status' => 'active',
            ],
            [
                'name' => 'Nidec Philippines Corporation',
                'contact_email' => 'contact@nidec.ph',
                'contact_number' => '+63 900 000 0000',
                'address' => 'Calamba, Laguna',
                'city' => 'Calamba',
                'province' => 'Laguna',
                'postal_code' => '4027',
                'contract_start' => now()->toDateString(),
                'contract_end' => now()->addYear()->toDateString(),
                'status' => 'active',
            ],
            [
                'name' => 'EHS Lens Philippines Inc.',
                'contact_email' => 'contact@ehslens.ph',
                'contact_number' => '+63 900 000 0000',
                'address' => 'Calamba, Laguna',
                'city' => 'Calamba',
                'province' => 'Laguna',
                'postal_code' => '4027',
                'contract_start' => now()->toDateString(),
                'contract_end' => now()->addYear()->toDateString(),
                'status' => 'active',
            ],
            [
                'name' => 'Yazaki-Torres Manufacturing Inc.',
                'contact_email' => 'contact@yazaki.ph',
                'contact_number' => '+63 900 000 0000',
                'address' => 'Calamba, Laguna',
                'city' => 'Calamba',
                'province' => 'Laguna',
                'postal_code' => '4027',
                'contract_start' => now()->toDateString(),
                'contract_end' => now()->addYear()->toDateString(),
                'status' => 'active',
            ],
        ];

        foreach ($companies as $c) {
            Company::updateOrCreate(
                ['name' => $c['name']],
                $c
            );
        }
    }
}
