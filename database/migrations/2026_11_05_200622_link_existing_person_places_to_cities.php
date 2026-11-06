<?php

use App\Modules\Shared\Audit;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('people')->whereNull('deleted_at')->whereNull('city_id')->whereNotNull('place')->where('place', '!=', '')->chunkById(200, function (Collection $people): void {
            foreach ($people as $person) {
                $cities = DB::table('cities')->whereNull('deleted_at')->where('name', trim($person->place))->limit(2)->pluck('id');
                if ($cities->count() !== 1) {
                    continue;
                }
                DB::transaction(function () use ($person, $cities): void {
                    $city = (int) $cities->first();
                    $updated = DB::table('people')->where('id', $person->id)->whereNull('city_id')->where('version', $person->version)->update(['city_id' => $city, 'version' => DB::raw('version + 1'), 'updated_at' => now()]);
                    if ($updated) {
                        Audit::record('update', 'people', $person->id, ['city_id' => null], ['city_id' => $city], null, $person->name);
                    }
                });
            }
        });
    }

    public function down(): void {}
};
