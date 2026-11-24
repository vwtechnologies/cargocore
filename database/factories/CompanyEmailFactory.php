<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanyEmail;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CompanyEmail> */
class CompanyEmailFactory extends Factory
{
    protected $model = CompanyEmail::class;

    public function definition(): array
    {
        return ['company_id' => Company::factory(), 'title' => 'OFFICE', 'email' => fake()->safeEmail(), 'status' => true];
    }
}
