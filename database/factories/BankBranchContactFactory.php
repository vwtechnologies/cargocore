<?php

namespace Database\Factories;

use App\Models\BankBranch;
use App\Models\BankBranchContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BankBranchContact> */
class BankBranchContactFactory extends Factory
{
    protected $model = BankBranchContact::class;

    public function definition(): array
    {
        return ['bank_branch_id' => BankBranch::factory(), 'title' => 'LANDLINE', 'number' => fake()->numerify('051-#######'), 'status' => true];
    }
}
