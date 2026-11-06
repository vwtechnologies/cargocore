<?php

namespace Database\Factories;

use App\Models\Marka;
use App\Models\Person;
use App\Models\PersonMarka;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PersonMarka> */
class PersonMarkaFactory extends Factory
{
    protected $model = PersonMarka::class;

    public function definition(): array
    {
        return ['person_id' => Person::factory(), 'marka_id' => Marka::factory(), 'status' => true];
    }
}
