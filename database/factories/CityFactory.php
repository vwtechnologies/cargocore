<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<City> */
class CityFactory extends Factory
{
    protected $model = City::class;

    public function definition(): array
    {
        return ['name' => fake()->city(), 'code' => fake()->unique()->bothify('CIT-??????'), 'country_id' => Country::factory()];
    }
}
