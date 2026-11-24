<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banks', function (Blueprint $table) {
            $table->string('bank_code', 20)->nullable()->after('short_name');
            $table->string('swift_code', 11)->nullable()->after('bank_code');
            $table->string('contact_number', 50)->nullable()->after('help_line');
            $table->string('internet_banking_url')->nullable()->after('website');
            $table->string('corporate_banking_url')->nullable()->after('internet_banking_url');
            $table->string('trade_hub_name')->nullable()->after('address');
            $table->string('trade_hub_contact', 50)->nullable()->after('trade_hub_name');
            $table->string('trade_hub_email')->nullable()->after('trade_hub_contact');
            $table->text('trade_hub_address')->nullable()->after('trade_hub_email');
        });
        Schema::table('bank_branches', function (Blueprint $table) {
            $table->string('email')->nullable()->after('phone_numbers');
            $table->string('portal_url')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('bank_branches', function (Blueprint $table) {
            $table->dropColumn(['email', 'portal_url']);
        });
        Schema::table('banks', function (Blueprint $table) {
            $table->dropColumn(['bank_code', 'swift_code', 'contact_number', 'internet_banking_url', 'corporate_banking_url', 'trade_hub_name', 'trade_hub_contact', 'trade_hub_email', 'trade_hub_address']);
        });
    }
};
