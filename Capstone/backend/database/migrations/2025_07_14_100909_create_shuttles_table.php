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
        Schema::create('shuttles', function (Blueprint $table) {
        $table->id();
        $table->string('model');
        $table->string('plate');
        $table->integer('capacity')->default(50);
        $table->enum('status', ['Active', 'Maintenance', 'Inactive'])->default('Inactive');
        $table->decimal('latitude', 10, 6)->nullable();  
        $table->decimal('longitude', 10, 6)->nullable();
        $table->softDeletes();
        $table->timestamps();
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shuttles');
    }
};
