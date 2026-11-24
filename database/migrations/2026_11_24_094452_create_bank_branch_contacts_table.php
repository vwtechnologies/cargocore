<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Branch phone numbers become titled rows (Landline 1, Fax, Manager…) like company contacts,
 * replacing the single JSON list of untitled numbers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_branch_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_branch_id')->constrained()->restrictOnDelete();
            $table->string('title', 80);
            $table->string('number', 50);
            $table->boolean('is_primary')->default(false);
            $table->boolean('status')->default(true)->index();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('primary_guard')->nullable()->storedAs('CASE WHEN is_primary = 1 AND status = 1 AND deleted_at IS NULL THEN bank_branch_id ELSE NULL END')->unique();
        });
        DB::table('bank_branches')->whereNotNull('phone_numbers')->orderBy('id')->each(function (object $branch) {
            $numbers = array_values(array_filter(array_map('trim', (array) json_decode($branch->phone_numbers, true)), 'strlen'));
            foreach ($numbers as $index => $number) {
                DB::table('bank_branch_contacts')->insert([
                    'bank_branch_id' => $branch->id,
                    'title' => 'PHONE '.($index + 1),
                    'number' => mb_substr($number, 0, 50),
                    'is_primary' => $index === 0 && ! $branch->deleted_at && $branch->status,
                    'status' => true,
                    'created_at' => $branch->created_at,
                    'updated_at' => $branch->updated_at,
                ]);
            }
        });
        Schema::table('bank_branches', function (Blueprint $table) {
            $table->dropColumn('phone_numbers');
        });
    }

    public function down(): void
    {
        Schema::table('bank_branches', function (Blueprint $table) {
            $table->json('phone_numbers')->nullable()->after('nift_code');
        });
        DB::table('bank_branch_contacts')->whereNull('deleted_at')->orderBy('id')->get()->groupBy('bank_branch_id')->each(function ($contacts, $branchId) {
            DB::table('bank_branches')->where('id', $branchId)->update(['phone_numbers' => json_encode($contacts->pluck('number')->values())]);
        });
        Schema::dropIfExists('bank_branch_contacts');
    }
};
