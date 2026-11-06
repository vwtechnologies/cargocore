<?php

namespace Database\Factories;

use App\Models\EmployeeProfile;
use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<EmployeeProfile> */
class EmployeeProfileFactory extends Factory
{
    protected $model = EmployeeProfile::class;

    public function definition(): array
    {
        return ['person_id' => Person::factory(), 'salary' => '50000.00'];
    }
}
