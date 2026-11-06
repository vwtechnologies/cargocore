<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->string('name_guard')->nullable()->storedAs('CASE WHEN deleted_at IS NULL THEN name ELSE NULL END')->unique();
            $table->dropUnique(['name']);
        });
    }

    public function down(): void
    {
        if (DB::table('countries')->select('name')->groupBy('name')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new RuntimeException('Cannot restore the original country name constraint while deleted countries share names.');
        }

        Schema::table('countries', function (Blueprint $table) {
            $table->unique('name');
            $table->dropUnique(['name_guard']);
            $table->dropColumn('name_guard');
        });
    }
};
