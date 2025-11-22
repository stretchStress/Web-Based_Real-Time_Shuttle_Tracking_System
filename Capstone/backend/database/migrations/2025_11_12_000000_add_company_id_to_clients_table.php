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
        // Only add the column if it does not exist to avoid breaking existing installs
        if (!Schema::hasColumn('clients', 'company_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->foreignId('company_id')->nullable()->constrained('companies')->onDelete('cascade')->after('user_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('clients', 'company_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropConstrainedForeignId('company_id');
            });
        }
    }
};
