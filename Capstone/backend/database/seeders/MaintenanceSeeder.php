<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Maintenance;
use App\Models\Shuttle;
use Carbon\Carbon;

class MaintenanceSeeder extends Seeder
{
    public function run(): void
    {
        $shuttles = Shuttle::all();

        if ($shuttles->isEmpty()) {
            $this->command->warn('⚠️ No shuttles found. Please run ShuttleSeeder first.');
            return;
        }

        $this->command->info('Seeding 100 maintenance records across 2019–2024...');

        // Technician names
        $technicians = [
            'Juan Dela Cruz',
            'May Santos',
            'Carlos Rodriguez',
            'Ana Garcia',
            'Michael Torres',
            'Sarah Martinez',
            'James Wilson',
            'Emily Brown',
            'Robert Lee',
            'Jennifer Davis',
            'David Anderson',
            'Lisa Thompson',
        ];

        // Maintenance descriptions
        $descriptions = [
            'Routine engine oil change and filter replacement.',
            'Brake system inspection and pad replacement.',
            'Tire rotation and pressure check.',
            'Battery replacement and electrical system check.',
            'Air conditioning system service and filter cleaning.',
            'Transmission fluid change and inspection.',
            'Cooling system flush and radiator check.',
            'Suspension system inspection and alignment.',
            'Windshield wiper replacement.',
            'Headlight and taillight bulb replacement.',
            'Exhaust system inspection and repair.',
            'Steering system check and fluid replacement.',
            'Fuel system cleaning and filter replacement.',
            'Alternator and starter motor inspection.',
            'Belts and hoses replacement.',
            'Spark plugs replacement and ignition system check.',
            'Wheel bearing inspection and lubrication.',
            'Power steering fluid replacement.',
            'Cabin air filter replacement.',
            'Fluid levels check and top-up.',
            'Major engine overhaul and parts replacement.',
            'Differential oil change.',
            'Shock absorber replacement.',
            'Brake fluid flush and replacement.',
            'Engine timing belt replacement.',
            'Radiator hose replacement.',
            'Serpentine belt replacement.',
            'Fuel pump inspection and replacement.',
            'Ignition coil replacement.',
            'Oxygen sensor replacement.',
            'Catalytic converter inspection.',
            'EGR valve cleaning.',
            'Throttle body cleaning.',
            'Mass airflow sensor cleaning.',
            'Idle air control valve cleaning.',
        ];

        $statuses = ['Under Maintenance', 'Done Repairing'];
        $years = [2019, 2020, 2021, 2022, 2023, 2024];

        // Distribute 100 records across 6 years (approximately 16-17 per year)
        $totalRecords = 100;
        $recordsPerYearBase = intdiv($totalRecords, count($years)); // 16
        $remainder = $totalRecords - ($recordsPerYearBase * count($years)); // 4

        foreach ($years as $index => $year) {
            $recordsThisYear = $recordsPerYearBase + ($index < $remainder ? 1 : 0);
            
            $this->command->info("📅 Generating {$recordsThisYear} maintenance records for year {$year}...");

            for ($i = 0; $i < $recordsThisYear; $i++) {
                $shuttle = $shuttles->random();
                $month = rand(1, 12);
                $day = rand(1, 28);
                $startDate = Carbon::create($year, $month, $day);
                
                // 70% Done Repairing, 30% Under Maintenance
                $status = rand(1, 100) <= 70 ? 'Done Repairing' : 'Under Maintenance';
                $endDate = null;
                if ($status === 'Done Repairing') {
                    $endDate = (clone $startDate)->addDays(rand(0, 10));
                }

                Maintenance::create([
                    'shuttle_id' => $shuttle->id,
                    'technician' => $technicians[array_rand($technicians)],
                    'date' => $startDate,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'description' => $descriptions[array_rand($descriptions)],
                    'status' => $status,
                ]);
            }
        }

        $totalCount = Maintenance::count();
        $underMaintenance = Maintenance::where('status', 'Under Maintenance')->count();
        $doneRepairing = Maintenance::where('status', 'Done Repairing')->count();

        $this->command->info("✅ Successfully generated:");
        $this->command->info("   🔧 Total Maintenance Records: {$totalCount}");
        $this->command->info("   ⚠️ Under Maintenance: {$underMaintenance}");
        $this->command->info("   ✅ Done Repairing: {$doneRepairing}");
        $this->command->info("   📅 Data spans from 2019 to 2024");
    }
}
