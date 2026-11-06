<?php

namespace Database\Factories;

use App\Models\BankBranch;
use App\Models\Person;
use App\Models\PersonBankAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PersonBankAccount> */
class PersonBankAccountFactory extends Factory
{
    protected $model = PersonBankAccount::class;

    public function definition(): array
    {
        return ['person_id' => Person::factory(), 'bank_branch_id' => BankBranch::factory(), 'account_title' => fake()->name(), 'account_number' => fake()->numerify('###########')];
    }
}
