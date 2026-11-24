<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanyAddress;
use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CompanyAddress> */
class CompanyAddressFactory extends Factory
{
    protected $model = CompanyAddress::class;

    public function definition(): array
    {
        return ['company_id' => Company::factory(), 'title' => 'REGISTERED', 'address_line_1' => fake()->streetAddress(), 'country_id' => Country::factory(), 'status' => true];
    }
}
