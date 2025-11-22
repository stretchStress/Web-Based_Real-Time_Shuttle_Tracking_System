<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Report;
use App\Models\Driver;
use App\Models\Shuttle;
use App\Models\Route;
use Carbon\Carbon;

class ReportSeeder extends Seeder
{
    public function run(): void
    {
        $drivers = Driver::with('user')->get();
        $shuttles = Shuttle::all();
        $routes = Route::all();

        if ($drivers->isEmpty() || $shuttles->isEmpty()) {
            $this->command->warn('⚠️ No drivers or shuttles found. Please run DriverUserSeeder and ShuttleSeeder first.');
            return;
        }

        $this->command->info('Seeding 5000 reports total across 2019–2025 (evenly distributed)...');

        // Feedback samples for driver performance
        $feedbackSamples = [
            "Driver was friendly and drove safely.",
            "Clean shuttle and smooth ride experience.",
            "Trip started a bit late but overall okay.",
            "Driver was very accommodating and polite.",
            "The route was efficient, and I felt safe.",
            "Good service, would ride again.",
            "Comfortable and on time.",
            "Driver maintained professionalism throughout.",
            "Excellent service, very punctual!",
            "Driver helped with my luggage, very kind.",
            "A bit rushed but still acceptable.",
            "Smooth journey, no complaints.",
            "Driver was courteous and helpful.",
            "The shuttle was clean and comfortable.",
            "Would recommend this driver to others.",
            "Professional behavior throughout the trip.",
        ];

        $years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

        $passengerNames = [
            'Alex Reyes',
            'Bianca Cruz',
            'Christian Dizon',
            'Danica Flores',
            'Ethan Ramirez',
            'Fiona Santos',
            'Gabe Hernandez',
            'Hannah Lopez',
            'Ivan Mercado',
            'Jasmine Ong',
            'Kyle Navarro',
            'Lara Jimenez',
        ];

        // We want exactly 5000 total records across all years
        $totalReports = 5000;
        $reportsPerYearBase = intdiv($totalReports, count($years)); // 833
        $remainder = $totalReports - ($reportsPerYearBase * count($years)); // 2

        // Split evenly between two types
        $typeSplitRatio = 0.5; // 50% performance, 50% usage

        foreach ($years as $index => $year) {
            $reportsThisYear = $reportsPerYearBase + ($index < $remainder ? 1 : 0); // spread remainder across early years
            $performanceCount = (int) round($reportsThisYear * $typeSplitRatio);
            $usageCount = $reportsThisYear - $performanceCount;

            $this->command->info("📅 Generating {$reportsThisYear} records for year {$year} ({$performanceCount} performance / {$usageCount} usage)...");

            // === Driver Performance ===
            for ($i = 0; $i < $performanceCount; $i++) {
                $driver = $drivers->random();
                $shuttle = $shuttles->random();
                $route = $routes->random();
                // For 2025 use January-November only
                $month = ($year === 2025) ? rand(1, 11) : rand(1, 12);
                $day = rand(1, 28);
                $hour = rand(6, 21);
                $minute = rand(0, 59);
                $feedbackDate = Carbon::create($year, $month, $day, $hour, $minute);

                Report::create([
                    'title'         => 'Driver Performance',
                    'type'          => 'Performance Metrics',
                    'source'        => 'Client Feedback',
                    'passenger_name'=> $passengerNames[array_rand($passengerNames)],
                    'description'   => $feedbackSamples[array_rand($feedbackSamples)],
                    'date'          => $feedbackDate->toDateString(),
                    'reported_at'   => $feedbackDate,
                    'rating'        => rand(3, 5),
                    'driver_id'     => $driver->id,
                    'shuttle_id'    => $shuttle->id,
                    'route_id'      => $route->id,
                    'plate_number'  => $shuttle->plate,
                ]);
            }

            // === Shuttle Usage ===
            for ($i = 0; $i < $usageCount; $i++) {
                $driver = $drivers->random();
                $shuttle = $shuttles->random();
                $route = $routes->random();
                // For 2025 use January-November only
                $month = ($year === 2025) ? rand(1, 11) : rand(1, 12);
                $tripsPerMonth = rand(50, 150);

                $usageDate = Carbon::create($year, $month, 1);

                Report::create([
                    'title'         => 'Shuttle Usage',
                    'type'          => 'Usage Statistics',
                    'source'        => 'System Logs',
                    'description'   => "Monthly usage report for {$shuttle->model} on " . ($route->name ?? 'Unknown Route'),
                    'date'          => $usageDate,
                    'reported_at'   => $usageDate->copy()->setTime(8, 0),
                    'trips'         => $tripsPerMonth,
                    'driver_id'     => $driver->id,
                    'shuttle_id'    => $shuttle->id,
                    'route_id'      => $route->id,
                ]);
            }
        }

        // Count total records created
        $totalCount = Report::count();
        $performanceCount = Report::where('title', 'Driver Performance')->count();
        $usageCount = Report::where('title', 'Shuttle Usage')->count();

        $this->command->info("✅ Successfully generated:");
        $this->command->info("   📊 Total Reports: {$totalCount}");
        $this->command->info("   👤 Driver Performance: {$performanceCount}");
        $this->command->info("   🚐 Shuttle Usage: {$usageCount}");
        $this->command->info("   📅 Data spans from 2019 to 2025");

        // === Incident Reports ===
        $this->command->info('Seeding incident reports for 2019–2024...');

        // Incident report samples
        $incidentSamples = [
            "Minor fender bender with another vehicle at intersection. No injuries reported.",
            "Passenger fell while boarding due to wet floor. Minor bruise, treated on-site.",
            "Shuttle experienced engine overheating.",
            "Flat tire on route. Changed tire and continued journey with 15-minute delay.",
            "Brake malfunction detected. Shuttle taken out of service for immediate inspection.",
            "Passenger altercation on board. Resolved by driver, no police involvement needed.",
            "Traffic collision with minor damage.",
            "Medical emergency - passenger fainted. Emergency services called, passenger recovered.",
            "Shuttle door malfunction - door would not close properly. Repaired same day.",
            "Weather-related incident - heavy rain caused visibility issues, minor accident.",
            "Road debris caused windshield crack.",
            "Passenger slipped on wet steps. Driver provided first aid assistance.",
            "Engine warning light appeared.",
            "Rear-end collision at traffic light. Minor damage, no injuries.",
            "AC system failure during hot weather.",
            "Passenger complaint about aggressive driving.",
            "Broken side mirror from narrow street.",
            "Fuel leak detected. Shuttle immediately taken out of service.",
            "Minor scrape from parking.",
            "Battery died while on route. Jump-started and battery replaced.",
            "Shuttle hit pothole causing suspension damage.",
            "Transmission issues - rough shifting. Taken for service immediately.",
        ];

        $incidentYears = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
        
        // Generate approximately 150-200 incident reports total (roughly 25-35 per year)
        $incidentsPerYear = 30; // Average incidents per year
        
        foreach ($incidentYears as $year) {
            $incidentCount = rand(20, 40); // Randomize between 20-40 per year
            $this->command->info("📅 Generating {$incidentCount} incident reports for year {$year}...");

            for ($i = 0; $i < $incidentCount; $i++) {
                $driver = $drivers->random();
                $shuttle = $shuttles->random();
                $route = $routes->random();
                // For 2025 use January-November only
                $month = ($year === 2025) ? rand(1, 11) : rand(1, 12);
                $day = rand(1, 28);
                $hour = rand(0, 23);
                $minute = rand(0, 59);
                $incidentDate = Carbon::create($year, $month, $day, $hour, $minute);

                Report::create([
                    'title'         => 'Incident Report',
                    'type'          => 'Incident',
                    'source'        => 'Driver Report',
                    'description'   => $incidentSamples[array_rand($incidentSamples)],
                    'date'          => $incidentDate->toDateString(),
                    'reported_at'   => $incidentDate,
                    'driver_id'     => $driver->id,
                    'shuttle_id'    => $shuttle->id,
                    'route_id'      => $route->id,
                    'plate_number'  => $shuttle->plate,
                ]);
            }
        }

        $incidentCount = Report::where('title', 'Incident Report')->count();
        $this->command->info("✅ Incident Reports generated: {$incidentCount}");
        $this->command->info("   📊 Total Reports (including incidents): " . Report::count());
    }
}