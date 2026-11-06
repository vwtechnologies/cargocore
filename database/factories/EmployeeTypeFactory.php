<?php

namespace Database\Factories;

use App\Models\EmployeeType;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<EmployeeType> */
class EmployeeTypeFactory extends Factory
{
    protected $model = EmployeeType::class;

    public function definition(): array
    {
        return ['name' => fake()->unique()->jobTitle(), 'type_number' => fake()->unique()->numberBetween(100, 100000)];
    }
}
