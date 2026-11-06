<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\SubCompany;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SubCompany> */
class SubCompanyFactory extends Factory
{
    protected $model = SubCompany::class;

    public function definition(): array
    {
        return ['name' => fake()->company(), 'company_id' => Company::factory()];
    }
}
