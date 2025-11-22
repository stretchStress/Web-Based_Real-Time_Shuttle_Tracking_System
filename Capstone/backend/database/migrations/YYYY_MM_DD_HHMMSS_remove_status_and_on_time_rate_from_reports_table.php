<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            if (Schema::hasColumn('reports', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('reports', 'on_time_rate')) {
                $table->dropColumn('on_time_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('status')->default('Pending')->nullable();
            $table->unsignedInteger('on_time_rate')->nullable();
        });
    }
};

