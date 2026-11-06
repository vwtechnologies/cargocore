<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class E2ESeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('testing') || config('database.connections.'.config('database.default').'.database') !== 'cargocore_test' || ! env('E2E_PASSWORD')) {
            throw new \RuntimeException('E2E fixtures require the isolated test database and an explicit generated password.');
        }
        $this->call(DemoSeeder::class);
        User::create(['name' => 'QA Administrator', 'username' => 'qa.admin', 'role_id' => Role::where('name', 'Super Admin')->firstOrFail()->id, 'password' => env('E2E_PASSWORD'), 'must_change_password' => false, 'status' => true]);
    }
}
