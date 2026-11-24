<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('type', 80)->nullable();
            $table->foreignId('parent_company_id')->nullable()->constrained('companies')->restrictOnDelete();
            foreach (['ntn', 'strn', 'weboc_id', 'psw_id'] as $field) {
                $table->string($field, 100)->nullable();
            }
        });
        foreach (['company_contacts', 'company_emails', 'company_addresses', 'company_owners'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name) {
                $table->id();
                $table->foreignId('company_id')->constrained()->restrictOnDelete();
                $table->boolean('status')->default(true)->index();
                $table->unsignedInteger('version')->default(1);
                $table->timestamps();
                $table->softDeletes();
                if ($name === 'company_owners') {
                    $table->foreignId('person_id')->nullable()->constrained('people')->restrictOnDelete();
                    $table->string('name');
                    $table->string('cnic', 13)->nullable();
                    $table->string('designation')->nullable();
                    $table->decimal('ownership_percentage', 5, 2)->nullable();
                } else {
                    $table->string('title', 80);
                    $table->boolean('is_primary')->default(false);
                    $table->unsignedBigInteger('primary_guard')->nullable()->storedAs('CASE WHEN is_primary = 1 AND status = 1 AND deleted_at IS NULL THEN company_id ELSE NULL END')->unique();
                    if ($name === 'company_contacts') {
                        $table->string('number', 50);
                    } elseif ($name === 'company_emails') {
                        $table->string('email');
                    } else {
                        $table->text('address_line_1');
                        $table->text('address_line_2')->nullable();
                        $table->foreignId('country_id')->nullable()->constrained()->restrictOnDelete();
                        $table->foreignId('city_id')->nullable()->constrained()->restrictOnDelete();
                        $table->string('postal_code', 30)->nullable();
                    }
                }
            });
        }
        DB::table('companies')->whereNull('deleted_at')->orderBy('id')->each(function (object $company) {
            $base = ['company_id' => $company->id, 'title' => 'PRIMARY', 'status' => true, 'is_primary' => true, 'created_at' => $company->created_at, 'updated_at' => $company->updated_at];
            if ($company->contact_number) {
                DB::table('company_contacts')->insert($base + ['number' => $company->contact_number]);
            }
            if ($company->address) {
                DB::table('company_addresses')->insert($base + ['address_line_1' => $company->address]);
            }
        });
        Schema::table('person_bank_accounts', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('company_address_id')->nullable()->constrained()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('person_bank_accounts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_address_id');
            $table->dropConstrainedForeignId('company_id');
        });
        foreach (['company_owners', 'company_addresses', 'company_emails', 'company_contacts'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_company_id');
            $table->dropColumn(['type', 'ntn', 'strn', 'weboc_id', 'psw_id']);
        });
    }
};
