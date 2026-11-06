<?php

use App\Models\Person;
use App\Modules\Shared\Audit;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('people', function (Blueprint $table) {
            $table->boolean('is_employee')->default(false);
        });

        Person::whereHas('associations.classifications', fn (Builder $assignments) => VisibleRecords::apply($assignments, 'classifications')->whereHas('businessType', fn (Builder $types) => $types->where('is_employee', true)))
            ->chunkById(100, function (Collection $people): void {
                foreach ($people as $person) {
                    DB::transaction(function () use ($person): void {
                        $current = Person::lockForUpdate()->findOrFail($person->id);
                        $current->is_employee = true;
                        $current->version++;
                        $current->save();
                        Audit::record('update', 'people', $current->id, ['is_employee' => false], ['is_employee' => true], null, $current->name);
                    });
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('people', function (Blueprint $table) {
            $table->dropColumn('is_employee');
        });
    }
};
