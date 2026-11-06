<?php

namespace Database\Factories;

use App\Models\Bank;
use App\Models\BankOfficer;
use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BankOfficer> */
class BankOfficerFactory extends Factory
{
    protected $model = BankOfficer::class;

    public function definition(): array
    {
        return ['bank_id' => Bank::factory(), 'person_id' => Person::factory(), 'designation' => fake()->jobTitle()];
    }
}
