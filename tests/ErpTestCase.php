<?php

namespace Tests;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

abstract class ErpTestCase extends TestCase
{
    use LazilyRefreshDatabase;

    protected function administrator(): User
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->create(['role_id' => Role::where('name', 'Super Admin')->firstOrFail()->id]);
        $this->actingAs($user);

        return $user;
    }

    protected function operator(array $permissions, string $name = 'Operator'): User
    {
        $role = Role::factory()->create(['name' => $name]);
        foreach ($permissions as $permission) {
            $role->permissions()->attach(Permission::firstOrCreate(['name' => $permission])->id);
        }

        return User::factory()->create(['role_id' => $role->id]);
    }

    protected function createRecord(string $entity, array $data): array
    {
        return $this->postJson('/api/v1/'.$entity, $data)->assertCreated()->json('data');
    }
}
