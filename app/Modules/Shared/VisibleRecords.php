<?php

namespace App\Modules\Shared;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/** Active records whose required parents and reference masters remain available. */
class VisibleRecords
{
    public static function apply(Builder $query, string $entity): Builder
    {
        $query->where($query->getModel()->qualifyColumn('status'), true);
        $required = match ($entity) {
            'sub-companies' => ['company' => 'companies'],
            'cities' => ['country' => 'countries'],
            'branches' => ['bank' => 'banks', 'city' => 'cities'],
            'officers' => ['bank' => 'banks', 'person' => 'people'],
            'contacts' => ['person' => 'people'],
            'person-markas' => ['person' => 'people', 'marka' => 'markas'],
            'accounts' => ['person' => 'people', 'branch' => 'branches'],
            'associations' => ['person' => 'people', 'company' => 'companies'],
            'classifications' => ['association' => 'associations', 'businessType' => 'business-types'],
            default => [],
        };
        foreach ($required as $relation => $parent) {
            $query->whereHas($relation, fn (Builder $related) => self::apply($related, $parent));
        }
        if ($entity === 'banks') {
            $query->where(fn (Builder $bank) => $bank->whereNull('country_id')->orWhereHas('country', fn (Builder $country) => self::apply($country, 'countries')));
        }
        if ($entity === 'branches') {
            $query->whereHas('bank', fn (Builder $bank) => $bank->where(fn (Builder $scope) => $scope->whereNull('banks.country_id')->orWhereExists(fn (QueryBuilder $city) => $city->selectRaw('1')->from('cities as branch_country')->whereColumn('branch_country.id', 'bank_branches.city_id')->whereColumn('branch_country.country_id', 'banks.country_id'))));
        }
        if ($entity === 'officers') {
            $query->where(fn (Builder $officer) => $officer->whereNull('bank_branch_id')->orWhereHas('branch', fn (Builder $branch) => self::apply($branch, 'branches')));
        }

        return $query;
    }
}
