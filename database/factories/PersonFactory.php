<?php

namespace Database\Factories;

use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Person> */
class PersonFactory extends Factory
{
    protected $model = Person::class;

    public function definition(): array
    {
        return ['name' => fake()->name(), 'code' => fake()->unique()->bothify('PER-??????')];
    }
}
