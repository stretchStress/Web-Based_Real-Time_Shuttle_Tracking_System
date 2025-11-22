<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('reports', 'status')) {
            Schema::table('reports', function (Blueprint $table) {
                $table->string('status')->default('Pending')->after('date');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('reports', 'status')) {
            Schema::table('reports', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }
    }
};


