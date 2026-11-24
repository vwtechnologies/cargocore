<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanyContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CompanyContact> */
class CompanyContactFactory extends Factory
{
    protected $model = CompanyContact::class;

    public function definition(): array
    {
        return ['company_id' => Company::factory(), 'title' => 'OFFICE', 'number' => fake()->phoneNumber(), 'status' => true];
    }
}
