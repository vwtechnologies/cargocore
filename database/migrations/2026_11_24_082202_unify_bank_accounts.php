<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One bank account register replaces the separate bank, cheque and own-company account lists.
 * Categories are flags on the same row so an account is never entered twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('person_bank_accounts', function (Blueprint $table) {
            $table->foreignId('person_id')->nullable()->change();
            $table->string('short_title', 100)->nullable()->after('account_title');
            $table->string('account_holder_name')->nullable()->after('short_title');
            $table->string('account_holder_cnic', 13)->nullable()->after('account_holder_name');
            $table->string('authorized_signatory_name')->nullable()->after('account_holder_cnic');
            $table->string('authorized_signatory_cnic', 13)->nullable()->after('authorized_signatory_name');
            $table->string('account_type', 50)->nullable()->after('authorized_signatory_cnic');
            $table->date('opening_balance_date')->nullable()->after('account_type');
            $table->decimal('opening_balance', 19, 2)->nullable()->after('opening_balance_date');
            foreach (['is_cheque', 'is_beneficiary', 'is_employee', 'is_company', 'is_our_account', 'is_other'] as $category) {
                $table->boolean($category)->default(false)->index();
            }
        });
        DB::table('person_bank_accounts')->whereNotNull('company_id')->update(['is_our_account' => true]);
    }

    public function down(): void
    {
        Schema::table('person_bank_accounts', function (Blueprint $table) {
            $table->dropColumn(['short_title', 'account_holder_name', 'account_holder_cnic', 'authorized_signatory_name', 'authorized_signatory_cnic', 'account_type', 'opening_balance_date', 'opening_balance', 'is_cheque', 'is_beneficiary', 'is_employee', 'is_company', 'is_our_account', 'is_other']);
        });
    }
};
