<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run()
    {
        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'first_name' => 'Default',
                'last_name'  => 'Admin',
                'password'   => Hash::make('password123'),
                'role'       => 'admin',
            ]
        );
    }
}
