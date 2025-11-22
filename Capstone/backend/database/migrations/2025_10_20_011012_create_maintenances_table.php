<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shuttle_id')->constrained('shuttles')->onDelete('cascade');
            $table->string('technician');
            $table->date('date');
            $table->text('description');
            $table->enum('status', ['Under Maintenance', 'Done Repairing'])->default('Under Maintenance');
            $table->string('report_file')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenances');
    }
};
