<?php

namespace App\Modules\Shared;

use App\Models\Country;
use Illuminate\Support\Facades\DB;

class CountryOrder
{
    private const MAXIMUM_ORDER = 2147483647;

    private const TEMPORARY_ORDER = 4294967295;

    public static function prepare(?Country $country, ?int $requestedOrder): int
    {
        $order = $requestedOrder ?? ($country?->display_sequence ?? ((int) Country::max('display_sequence') + 1));
        if ($order > self::MAXIMUM_ORDER) {
            DomainRules::fail('display_sequence', 'There is no available display order.');
        }
        if ($country && (int) $country->display_sequence === $order) {
            return $order;
        }

        $occupant = Country::where('display_sequence', $order)->lockForUpdate()->first();
        if (! $occupant) {
            return $order;
        }
        if ($country) {
            DB::table('countries')->where('id', $country->id)->update(['display_sequence' => self::TEMPORARY_ORDER]);
            self::move($occupant, (int) $country->display_sequence);
        } else {
            $countries = Country::where('display_sequence', '>=', $order)->orderByDesc('display_sequence')->lockForUpdate()->get();
            if ((int) $countries->first()->display_sequence >= self::MAXIMUM_ORDER) {
                DomainRules::fail('display_sequence', 'The existing display orders cannot be shifted further.');
            }
            foreach ($countries as $shiftedCountry) {
                self::move($shiftedCountry, (int) $shiftedCountry->display_sequence + 1);
            }
        }

        return $order;
    }

    private static function move(Country $country, int $order): void
    {
        $before = $country->toArray();
        $country->display_sequence = $order;
        $country->version++;
        $country->save();
        Audit::record('update', 'countries', $country->id, $before, $country->toArray(), null, $country->name);
    }
}
