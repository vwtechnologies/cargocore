<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            $countries = DB::table('countries')->whereNull('deleted_at')->orderBy('display_sequence')->orderByDesc('id')->lockForUpdate()->get();
            $previousOrder = 0;
            foreach ($countries as $country) {
                $order = max(1, $previousOrder + 1, (int) $country->display_sequence);
                $previousOrder = $order;
                if ($order === (int) $country->display_sequence) {
                    continue;
                }
                DB::table('countries')->where('id', $country->id)->update(['display_sequence' => $order, 'version' => $country->version + 1, 'updated_at' => now()]);
                DB::table('audit_events')->insert([
                    'action' => 'update', 'entity' => 'countries', 'record_id' => $country->id, 'record_label' => $country->name,
                    'changes' => json_encode([
                        'display_sequence' => ['before' => (int) $country->display_sequence, 'after' => $order],
                        'version' => ['before' => $country->version, 'after' => $country->version + 1],
                    ], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                ]);
            }
        });

        Schema::table('countries', function (Blueprint $table) {
            $table->unsignedInteger('display_order_guard')->nullable()->storedAs('CASE WHEN deleted_at IS NULL THEN display_sequence ELSE NULL END')->unique();
        });
    }

    public function down(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->dropUnique(['display_order_guard']);
            $table->dropColumn('display_order_guard');
        });
    }
};
