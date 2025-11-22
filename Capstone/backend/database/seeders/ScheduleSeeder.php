<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Schedule;
use App\Models\Driver;
use App\Models\Shuttle;
use App\Models\Route;
use Carbon\Carbon;

class ScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $drivers = Driver::all();
        $shuttles = Shuttle::all();
        $routes = Route::all();

        if ($drivers->isEmpty() || $shuttles->isEmpty() || $routes->isEmpty()) {
            $this->command->warn('⚠️ No drivers, shuttles, or routes found. Please run DriverUserSeeder, ShuttleSeeder, and RouteSeeder first.');
            return;
        }

        $this->command->info('Seeding 1000 schedules across 2019–2025 (evenly distributed)...');

        $years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
        $totalSchedules = 1000;
        $schedulesPerYearBase = intdiv($totalSchedules, count($years));
        $remainder = $totalSchedules - ($schedulesPerYearBase * count($years));

            $daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            $statuses = ['Active', 'Inactive'];

        foreach ($years as $index => $year) {
            $schedulesThisYear = $schedulesPerYearBase + ($index < $remainder ? 1 : 0);

            $this->command->info("📅 Generating {$schedulesThisYear} schedules for year {$year}...");

            for ($i = 0; $i < $schedulesThisYear; $i++) {
                $driver = $drivers->random();
                $shuttle = $shuttles->random();
                $route = $routes->random();

                     // For 2025 use January-November only
                     $month = ($year === 2025) ? rand(1, 11) : rand(1, 12);
                     $dayOfMonth = rand(1, 28);
                $hour = rand(6, 21);
                $minute = rand(0, 59);

                   $scheduleDate = Carbon::create($year, $month, $dayOfMonth);
                   $dayOfWeek = $daysOfWeek[$scheduleDate->dayOfWeek];
                   $timeIn = Carbon::create($year, $month, $dayOfMonth, $hour, $minute);
                $timeOut = $timeIn->copy()->addHours(rand(1, 4))->addMinutes(rand(0, 59));

                Schedule::create([
                    'driver_id' => $driver->id,
                    'shuttle_id' => $shuttle->id,
                    'route_id' => $route->id,
                    'date' => $scheduleDate,
                       'day' => $dayOfWeek,
                    'time_in' => $timeIn,
                    'time_out' => $timeOut,
                       'status' => $statuses[array_rand($statuses)],
                ]);
            }
        }

        $this->command->info('✅ Successfully seeded 1000 schedules!');
    }
}
