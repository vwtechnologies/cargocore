<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Person;
use App\Models\PersonCompany;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PersonCompany> */
class PersonCompanyFactory extends Factory
{
    protected $model = PersonCompany::class;

    public function definition(): array
    {
        return ['person_id' => Person::factory(), 'company_id' => Company::factory()];
    }
}
