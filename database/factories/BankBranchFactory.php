<?php

namespace Database\Factories;

use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\City;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BankBranch> */
class BankBranchFactory extends Factory
{
    protected $model = BankBranch::class;

    public function definition(): array
    {
        return ['name' => fake()->city().' Branch', 'bank_id' => Bank::factory(), 'city_id' => City::factory()];
    }
}
