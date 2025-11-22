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
        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->string('company');
            $table->string('name');
            $table->enum('direction', ['Incoming', 'Outgoing'])->default('Incoming');
            $table->string('embarked');
            $table->json('pickup_points')->nullable();
            $table->string('disembarked');
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->decimal('embarked_lat', 10, 7)->nullable();
            $table->decimal('embarked_lng', 10, 7)->nullable();
            $table->decimal('disembarked_lat', 10, 7)->nullable();
            $table->decimal('disembarked_lng', 10, 7)->nullable();
            $table->json('pickup_coords')->nullable();
            $table->json('pickup_times')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('routes');
    }
};
