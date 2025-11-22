<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();

            // Main details
            $table->string('type')->default('General'); // e.g. Daily Report, Driver Performance, etc.
            $table->string('source')->nullable();
            $table->text('description');
            $table->date('date');
            $table->string('report_code')->nullable();

            // ✅ Relationships
            $table->foreignId('driver_id')->constrained('drivers')->onDelete('cascade');
            $table->foreignId('route_id')->constrained('routes')->onDelete('cascade');
            $table->foreignId('shuttle_id')->constrained('shuttles')->onDelete('cascade');

            // Optional analytics fields
            $table->unsignedInteger('on_time_rate')->nullable();
            $table->unsignedInteger('trips')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
