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
        Schema::table('banks', function (Blueprint $table) {
            $table->text('address')->nullable()->after('website');
        });

        Schema::table('bank_branches', function (Blueprint $table) {
            $table->text('address')->nullable()->after('phone_numbers');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bank_branches', function (Blueprint $table) {
            $table->dropColumn('address');
        });

        Schema::table('banks', function (Blueprint $table) {
            $table->dropColumn('address');
        });
    }
};
