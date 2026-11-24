<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanyOwner;
use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CompanyOwner> */
class CompanyOwnerFactory extends Factory
{
    protected $model = CompanyOwner::class;

    public function definition(): array
    {
        return ['company_id' => Company::factory(), 'person_id' => Person::factory(), 'name' => fn (array $attributes): string => Person::findOrFail($attributes['person_id'])->name, 'cnic' => fn (array $attributes): ?string => Person::findOrFail($attributes['person_id'])->cnic, 'designation' => 'DIRECTOR', 'ownership_percentage' => '25.00', 'status' => true];
    }
}
