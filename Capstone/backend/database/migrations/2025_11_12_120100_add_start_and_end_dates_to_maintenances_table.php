<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenances', function (Blueprint $table) {
            if (!Schema::hasColumn('maintenances', 'start_date')) {
                $table->date('start_date')->nullable()->after('technician');
            }

            if (!Schema::hasColumn('maintenances', 'end_date')) {
                $table->date('end_date')->nullable()->after('start_date');
            }
        });

        // Backfill new columns with existing `date` if available
        \DB::table('maintenances')
            ->whereNull('start_date')
            ->update(['start_date' => \DB::raw('date')]);
    }

    public function down(): void
    {
        Schema::table('maintenances', function (Blueprint $table) {
            if (Schema::hasColumn('maintenances', 'start_date')) {
                $table->dropColumn('start_date');
            }

            if (Schema::hasColumn('maintenances', 'end_date')) {
                $table->dropColumn('end_date');
            }
        });
    }
};


