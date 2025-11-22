<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shuttles', function (Blueprint $table) {
            $table->unsignedBigInteger('driver_id')->nullable()->after('status');
            $table->unsignedBigInteger('route_id')->nullable()->after('driver_id');

            $table->foreign('driver_id')
                ->references('id')->on('drivers')
                ->onDelete('set null');

            $table->foreign('route_id')
                ->references('id')->on('routes')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('shuttles', function (Blueprint $table) {
            $table->dropForeign(['driver_id']);
            $table->dropForeign(['route_id']);
            $table->dropColumn(['driver_id', 'route_id']);
        });
    }

};
