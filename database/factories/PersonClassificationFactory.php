<?php

namespace Database\Factories;

use App\Models\BusinessType;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PersonClassification> */
class PersonClassificationFactory extends Factory
{
    protected $model = PersonClassification::class;

    public function definition(): array
    {
        return ['person_company_id' => PersonCompany::factory(), 'business_type_id' => BusinessType::factory()];
    }
}
