<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\PersonContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PersonContact> */
class PersonContactFactory extends Factory
{
    protected $model = PersonContact::class;

    public function definition(): array
    {
        return ['person_id' => Person::factory(), 'email' => fake()->safeEmail()];
    }
}
