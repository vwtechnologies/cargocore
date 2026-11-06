<?php

namespace Database\Factories;

use App\Models\Marka;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Marka> */
class MarkaFactory extends Factory
{
    protected $model = Marka::class;

    public function definition(): array
    {
        return ['code' => fake()->unique()->bothify('MK-??????'), 'description' => fake()->sentence()];
    }
}
