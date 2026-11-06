<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function record(Blueprint $table, bool $code = true): void
    {
        $table->id();
        if ($code) {
            $table->string('code', 50)->nullable()->unique();
        }
        $table->boolean('status')->default(true)->index();
        $table->unsignedInteger('version')->default(1);
        $table->timestamps();
        $table->softDeletes();
    }

    public function up(): void
    {
        Schema::create('record_locks', function (Blueprint $t) {
            $t->string('name')->primary();
        });
        DB::table('record_locks')->insert([['name' => 'company_defaults'], ['name' => 'access']]);
        Schema::create('roles', function (Blueprint $t) {
            $this->record($t, false);
            $t->string('name')->unique();
            $t->boolean('is_system')->default(false);
        });
        Schema::create('permissions', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
        });
        Schema::create('permission_role', function (Blueprint $t) {
            $t->foreignId('role_id')->constrained()->restrictOnDelete();
            $t->foreignId('permission_id')->constrained()->restrictOnDelete();
            $t->primary(['role_id', 'permission_id']);
        });
        Schema::create('companies', function (Blueprint $t) {
            $this->record($t);
            $t->string('name')->index();
            $t->string('short_name', 50)->nullable();
            $t->text('address')->nullable();
            $t->string('contact_number', 50)->nullable();
            $t->string('fax_number', 50)->nullable();
            $t->string('website')->nullable();
            $t->boolean('is_default')->default(false);
            $t->unsignedTinyInteger('default_guard')->nullable()->storedAs('CASE WHEN is_default = 1 AND deleted_at IS NULL THEN 1 ELSE NULL END')->unique();
        });
        Schema::create('company_user', function (Blueprint $t) {
            $t->foreignId('company_id')->constrained()->restrictOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->primary(['company_id', 'user_id']);
        });
        Schema::create('sub_companies', function (Blueprint $t) {
            $this->record($t);
            $t->foreignId('company_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->boolean('is_default')->default(false);
            $t->text('address')->nullable();
            $t->string('website')->nullable();
            foreach (['contact_numbers', 'fax_numbers', 'mobile_numbers'] as $column) {
                $t->json($column)->nullable();
            }
            $t->unsignedBigInteger('default_guard')->nullable()->storedAs('CASE WHEN is_default = 1 AND deleted_at IS NULL THEN company_id ELSE NULL END')->unique();
        });
        Schema::create('countries', function (Blueprint $t) {
            $this->record($t);
            $t->string('name')->unique();
            $t->string('short_name', 20)->nullable();
            $t->unsignedInteger('display_sequence')->default(0);
        });
        Schema::create('cities', function (Blueprint $t) {
            $this->record($t);
            $t->foreignId('country_id')->constrained()->restrictOnDelete();
            $t->string('name')->index();
            $t->string('short_name_1', 50)->nullable();
            $t->string('short_name_2', 50)->nullable();
        });
        Schema::create('banks', function (Blueprint $t) {
            $this->record($t);
            $t->string('name')->index();
            $t->string('short_name', 50)->nullable();
            $t->string('uan', 50)->nullable();
            $t->string('help_line', 50)->nullable();
            $t->string('e_bank')->nullable();
            $t->string('website')->nullable();
        });
        Schema::create('bank_branches', function (Blueprint $t) {
            $this->record($t);
            $t->foreignId('bank_id')->constrained()->restrictOnDelete();
            $t->foreignId('city_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->string('branch_code', 50)->nullable();
            $t->string('nift_code', 50)->nullable();
            $t->json('phone_numbers')->nullable();
        });
        Schema::create('employee_types', function (Blueprint $t) {
            $this->record($t);
            $t->unsignedInteger('type_number')->unique();
            $t->string('name')->unique();
        });
        Schema::create('business_types', function (Blueprint $t) {
            $this->record($t);
            $t->string('name')->unique();
            $t->boolean('is_employee')->default(false);
        });
        Schema::create('markas', function (Blueprint $t) {
            $this->record($t);
            $t->text('description');
        });
        Schema::create('people', function (Blueprint $t) {
            $this->record($t);
            $t->string('name')->index();
            $t->string('father_husband_name')->nullable();
            $t->string('cnic', 13)->nullable()->unique();
            $t->date('date_of_birth')->nullable();
            $t->string('gender', 50)->nullable();
            $t->string('ntn', 50)->nullable();
            $t->string('strn', 50)->nullable();
            $t->date('joining_date')->nullable();
            $t->string('place')->nullable();
            $t->text('comments')->nullable();
        });
        Schema::create('person_contacts', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $t->string('label', 80)->nullable();
            $t->text('address')->nullable();
            $t->string('phone', 50)->nullable();
            $t->string('mobile', 50)->nullable();
            $t->string('email')->nullable();
        });
        Schema::create('bank_officers', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('bank_id')->constrained()->restrictOnDelete();
            $t->foreignId('bank_branch_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $t->string('designation');
            $t->string('contact_number', 50)->nullable();
            $t->string('email')->nullable();
        });
        Schema::create('person_bank_accounts', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $t->foreignId('bank_branch_id')->constrained()->restrictOnDelete();
            $t->string('account_number', 100)->nullable();
            $t->string('iban', 34)->nullable();
            $t->string('account_title');
        });
        Schema::create('person_companies', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $t->foreignId('company_id')->constrained()->restrictOnDelete();
            $t->unique(['person_id', 'company_id']);
        });
        Schema::create('person_classifications', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_company_id')->constrained()->restrictOnDelete();
            $t->foreignId('business_type_id')->constrained()->restrictOnDelete();
            $t->decimal('opening_balance', 19, 2)->nullable();
            $t->unique(['person_company_id', 'business_type_id']);
        });
        Schema::create('employee_profiles', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_id')->unique()->constrained('people')->restrictOnDelete();
            $t->decimal('salary', 19, 2)->nullable();
        });
        Schema::create('employee_profile_type', function (Blueprint $t) {
            $t->foreignId('employee_profile_id')->constrained()->restrictOnDelete();
            $t->foreignId('employee_type_id')->constrained()->restrictOnDelete();
            $t->primary(['employee_profile_id', 'employee_type_id']);
        });
        Schema::create('documents', function (Blueprint $t) {
            $this->record($t, false);
            $t->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $t->string('kind', 30)->default('identification');
            $t->string('document_type', 100)->nullable();
            $t->string('document_number', 100)->nullable();
            $t->date('expires_on')->nullable();
            $t->string('original_name');
            $t->string('path');
            $t->string('mime_type', 100);
            $t->unsignedBigInteger('size');
            $t->string('sha256', 64);
        });
        Schema::table('users', function (Blueprint $t) {
            $t->string('username', 80)->unique();
            $t->string('email')->nullable()->change();
            $t->foreignId('role_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('person_id')->nullable()->unique()->constrained('people')->restrictOnDelete();
            $t->boolean('status')->default(true);
            $t->boolean('must_change_password')->default(true);
            $t->unsignedInteger('version')->default(1);
        });
        Schema::create('audit_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('company_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('action', 60)->index();
            $t->string('entity', 80)->index();
            $t->unsignedBigInteger('record_id')->nullable()->index();
            $t->string('record_label')->nullable();
            $t->json('changes')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::table('users', function (Blueprint $t) {
            $t->dropConstrainedForeignId('role_id');
            $t->dropConstrainedForeignId('person_id');
            $t->dropColumn(['username', 'status', 'must_change_password', 'version']);
        });
        foreach (['documents', 'employee_profile_type', 'employee_profiles', 'person_classifications', 'person_companies', 'person_bank_accounts', 'bank_officers', 'person_contacts', 'people', 'markas', 'business_types', 'employee_types', 'bank_branches', 'banks', 'cities', 'countries', 'sub_companies', 'company_user', 'companies', 'permission_role', 'permissions', 'roles', 'record_locks'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
