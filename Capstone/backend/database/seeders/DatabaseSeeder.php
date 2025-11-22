<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,
            DriverUserSeeder::class,
            CompanySeeder::class,
            ClientUserSeeder::class,
            RouteSeeder::class,
            ShuttleSeeder::class,
            ScheduleSeeder::class,
            ReportSeeder::class,
            MaintenanceSeeder::class,
        ]);
    }
}
