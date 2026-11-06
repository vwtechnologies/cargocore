<?php

namespace Tests\Feature;

use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Person;
use App\Models\Role;
use App\Models\SubCompany;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\UserRoleSeeder;
use Tests\ErpTestCase;

class BusinessAccessTest extends ErpTestCase
{
    public function test_explicit_user_role_setup_restores_the_requested_permissions_without_resetting_edits_during_general_seeding(): void
    {
        $this->administrator();
        $role = Role::where('name', 'USER')->firstOrFail();
        $role->permissions()->detach(Permission::where('name', 'people.create')->firstOrFail()->id);
        $this->seed(DatabaseSeeder::class);
        $this->assertFalse($role->permissions()->where('name', 'people.create')->exists());
        $this->seed(UserRoleSeeder::class);
        $this->assertEqualsCanonicalizing(UserRoleSeeder::permissions(), $role->permissions()->pluck('name')->all());
        $version = $role->refresh()->version;
        $this->seed(UserRoleSeeder::class);
        $this->assertSame($version, $role->refresh()->version);
    }

    public function test_user_role_sees_all_business_records_without_portal_memberships_but_cannot_manage_masters_or_administration(): void
    {
        $owner = $this->administrator();
        $companies = Company::factory()->count(2)->create();
        $child = SubCompany::factory()->create(['company_id' => $companies[1]->id]);
        $person = Person::factory()->create();
        $owner->update(['person_id' => $person->id]);
        $role = Role::where('name', 'USER')->firstOrFail();
        $this->assertEqualsCanonicalizing(UserRoleSeeder::permissions(), $role->permissions->pluck('name')->all());
        $user = User::factory()->create(['role_id' => $role->id]);
        $this->actingAs($user);
        $this->getJson('/api/v1/session')->assertOk()->assertJsonCount(2, 'companies')->assertJsonCount(0, 'portal_companies');
        $this->getJson('/api/v1/companies?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/companies/'.$companies[1]->id.'/sub-companies')->assertOk()->assertJsonPath('data.0.id', $child->id);
        $this->getJson('/api/v1/people/'.$person->id)->assertOk();
        foreach (['companies', 'countries', 'banks'] as $entity) {
            $this->getJson('/api/v1/'.$entity.'?context=management')->assertOk();
            $this->postJson('/api/v1/'.$entity, ['name' => 'Denied'])->assertForbidden();
        }
        foreach (['business-types', 'employee-types', 'users', 'roles', 'audit'] as $entity) {
            $this->getJson('/api/v1/'.$entity.'?context=management')->assertForbidden();
        }
        $this->getJson('/api/v1/people/'.$person->id.'/user-account')->assertForbidden();
        $this->getJson('/api/v1/business-types')->assertForbidden();
        $this->getJson('/api/v1/business-types?context=lookup')->assertOk();
        $this->getJson('/api/v1/employee-types?context=lookup')->assertOk();
        $employee = BusinessType::where('is_employee', true)->firstOrFail();
        $this->putJson('/api/v1/people/'.$person->id.'/company-roles/'.$companies[1]->id, [
            'version' => 0, 'classification_versions' => [], 'items' => [['business_type_id' => $employee->id, 'opening_balance' => '123.45']],
        ])->assertOk()->assertJsonPath('classifications.0.opening_balance', '123.45');
        $new = $this->postJson('/api/v1/people', ['name' => 'user created person'])->assertCreated()->json('data');
        $this->putJson('/api/v1/people/'.$new['id'], ['name' => 'updated person', 'version' => $new['version']])->assertOk()->assertJsonPath('data.name', 'UPDATED PERSON');
        $marka = $this->postJson('/api/v1/markas', ['code' => 'user-1', 'description' => 'mixed Case'])->assertCreated()->json('data');
        $this->postJson('/api/v1/people/'.$new['id'].'/person-markas', ['marka_id' => $marka['id'], 'status' => true])->assertCreated();
        $this->postJson('/api/v1/people/'.$new['id'].'/contacts', ['address' => 'My address', 'status' => true])->assertCreated();
        $this->deleteJson('/api/v1/markas/'.$marka['id'], ['version' => $marka['version']])->assertUnprocessable();
    }

    public function test_admin_sees_all_companies_and_non_super_accounts_but_roles_management_remains_super_admin_only(): void
    {
        $owner = $this->administrator();
        $company = Company::factory()->create();
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $other = User::factory()->create(['role_id' => Role::where('name', 'USER')->firstOrFail()->id]);
        $other->companies()->attach($company);
        $this->actingAs($admin);
        $this->getJson('/api/v1/companies/'.$company->id)->assertOk();
        $this->postJson('/api/v1/companies', ['name' => 'Admin-created company'])->assertCreated();
        $this->assertSame(0, $admin->companies()->count());
        $this->getJson('/api/v1/users?id='.$other->id)->assertOk()->assertJsonPath('data.0.id', $other->id);
        $this->getJson('/api/v1/users?id='.$owner->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/roles?context=management')->assertForbidden();
        $this->getJson('/api/v1/roles?context=lookup')->assertOk()->assertJsonMissing(['name' => 'Super Admin']);
        $this->postJson('/api/v1/roles', ['name' => 'denied', 'status' => true, 'permissions' => []])->assertForbidden();
        $this->actingAs($owner);
        $created = $this->postJson('/api/v1/roles', ['name' => 'Mixed Case Role', 'status' => true, 'permissions' => ['companies.view']])->assertCreated()->json('data');
        $this->postJson('/api/v1/roles', ['name' => 'Delegated permissions', 'status' => true, 'permissions' => ['roles.update']])->assertUnprocessable()->assertJsonValidationErrors('permissions');
        $this->putJson('/api/v1/roles/'.$created['id'], ['name' => 'Mixed Case Role', 'status' => true, 'permissions' => ['people.view'], 'version' => $created['version']])->assertOk();
        $this->putJson('/api/v1/roles/'.$created['id'], ['name' => 'stale role', 'status' => true, 'permissions' => [], 'version' => $created['version']])->assertConflict();
    }
}
