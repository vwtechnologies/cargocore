<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Person;
use App\Models\PersonCompany;
use App\Models\Role;
use App\Models\SubCompany;
use App\Models\User;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\ErpTestCase;

class AccessSecurityTest extends ErpTestCase
{
    public function test_portal_company_choices_follow_explicit_assignments_for_every_role(): void
    {
        $super = $this->administrator();
        $unassignedDefault = Company::factory()->create(['is_default' => true]);
        $first = Company::factory()->create();
        $second = Company::factory()->create();
        $inactive = Company::factory()->create(['status' => false]);
        $deleted = Company::factory()->create();
        $deleted->delete();
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $operator = $this->operator(['companies.view']);
        foreach ([$super, $admin, $operator] as $user) {
            $user->companies()->sync([$first->id, $second->id, $inactive->id, $deleted->id]);
            $this->actingAs($user);
            $response = $this->getJson('/api/v1/session')->assertOk()->assertJsonCount(2, 'portal_companies');
            $this->assertSame([$first->id, $second->id], array_column($response->json('portal_companies'), 'id'));
            $this->assertNotContains($unassignedDefault->id, array_column($response->json('portal_companies'), 'id'));
            $this->assertContains($unassignedDefault->id, array_column($response->json('companies'), 'id'));
            $this->getJson('/api/v1/companies/'.$unassignedDefault->id)->assertOk();
            $user->companies()->sync([$second->id]);
            $this->getJson('/api/v1/session')->assertOk()->assertJsonCount(1, 'portal_companies')->assertJsonPath('portal_companies.0.id', $second->id);
            $user->companies()->detach();
            $this->getJson('/api/v1/session')->assertOk()->assertJsonCount(0, 'portal_companies');
        }
    }

    public function test_guests_and_unprivileged_users_cannot_read_or_mutate_records(): void
    {
        $this->getJson('/api/v1/companies')->assertUnauthorized();
        $user = $this->operator(['companies.view']);
        $this->actingAs($user);
        $this->postJson('/api/v1/companies', ['name' => 'Forbidden'])->assertForbidden();
        $this->getJson('/api/v1/people')->assertForbidden();
        foreach (EntityRegistry::permissions() as $permission) {
            $this->assertSame($permission === 'companies.view', Gate::forUser($user)->allows($permission));
        }
    }

    public function test_company_memberships_do_not_restrict_business_records_and_relationship_rules_still_apply(): void
    {
        $this->administrator();
        $a = Company::factory()->create();
        $b = Company::factory()->create();
        $sub = SubCompany::factory()->create(['company_id' => $b->id]);
        $person = Person::factory()->create();
        $hidden = PersonCompany::factory()->create(['person_id' => $person->id, 'company_id' => $b->id]);
        $user = $this->operator(['companies.view', 'companies.update', 'people.view', 'associations.view', 'associations.create']);
        $user->companies()->attach($a);
        $this->actingAs($user);
        $this->getJson('/api/v1/companies')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/companies/'.$b->id)->assertOk();
        $this->getJson('/api/v1/sub-companies/'.$sub->id)->assertOk();
        $this->getJson('/api/v1/companies/'.$b->id.'/sub-companies')->assertOk();
        $this->getJson('/api/v1/people/'.$person->id.'/associations')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/associations/'.$hidden->id.'/classifications')->assertOk();
        $this->postJson('/api/v1/people/'.$person->id.'/associations', ['company_id' => $b->id])->assertUnprocessable();
    }

    public function test_admin_cannot_assign_super_admin_or_change_roles_but_can_assign_any_portal_company(): void
    {
        $super = $this->administrator();
        $adminRole = Role::where('name', 'Admin')->firstOrFail();
        $a = Company::factory()->create();
        $b = Company::factory()->create();
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'two_factor_confirmed_at' => now()]);
        $admin->companies()->attach($a);
        $this->actingAs($admin);
        $this->postJson('/api/v1/roles', ['name' => 'Elevation', 'permissions' => [], 'status' => true])->assertForbidden();
        $payload = ['name' => 'Attack', 'username' => 'attack', 'role_id' => $super->role_id, 'company_ids' => [$a->id], 'status' => true, 'password' => 'long-password-123', 'password_confirmation' => 'long-password-123'];
        $this->postJson('/api/v1/users', $payload)->assertForbidden();
        $role = Role::factory()->create();
        $this->postJson('/api/v1/users', array_replace($payload, ['role_id' => $role->id, 'company_ids' => [$b->id]]))->assertCreated();
        $this->assertDatabaseHas('users', ['username' => 'attack', 'role_id' => $role->id]);
    }

    public function test_last_super_admin_is_protected_and_user_password_is_write_only(): void
    {
        $super = $this->administrator();
        $this->putJson('/api/v1/users/'.$super->id, ['name' => $super->name, 'username' => $super->username, 'role_id' => $super->role_id, 'company_ids' => [], 'status' => false, 'version' => 1])->assertUnprocessable()->assertJsonValidationErrors('status');
        $role = Role::factory()->create();
        $response = $this->postJson('/api/v1/users', ['name' => 'New User', 'username' => 'new.user', 'role_id' => $role->id, 'company_ids' => [], 'status' => true, 'password' => 'temporary-password-12', 'password_confirmation' => 'temporary-password-12'])->assertCreated();
        $response->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.two_factor_secret');
        $user = User::where('username', 'new.user')->firstOrFail();
        $this->assertNotSame('temporary-password-12', $user->password);
        $this->assertFalse($user->must_change_password);
        $this->assertTrue(Hash::check('temporary-password-12', $user->password));
    }

    public function test_mass_assignment_and_sql_sort_cannot_change_protected_fields(): void
    {
        $this->administrator();
        $person = $this->createRecord('people', ['name' => '<script>alert(1)</script>', 'code' => 'HACKED', 'id' => 999, 'version' => 999, 'is_super_admin' => true]);
        $this->assertNotSame(999, $person['id']);
        $this->assertNotSame('HACKED', $person['code']);
        $this->assertSame(1, $person['version']);
        $this->getJson('/api/v1/people?sort=password&direction=desc;DROP TABLE users')->assertOk();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_linkable_people_excludes_inactive_deleted_and_already_linked_people(): void
    {
        $this->administrator();
        $available = Person::factory()->create(['name' => 'Available person']);
        $linked = Person::factory()->create(['name' => 'Already linked person']);
        $inactive = Person::factory()->create(['status' => false]);
        $deleted = Person::factory()->create();
        $deleted->delete();
        $user = User::factory()->create(['person_id' => $linked->id, 'status' => false, 'role_id' => Role::factory()->create()->id]);

        $this->getJson('/api/v1/users/linkable-people')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $available->id)->assertJsonMissingPath('data.0.cnic');
        $this->getJson('/api/v1/users/linkable-people?user_id='.$user->id.'&id='.$linked->id)->assertOk()->assertJsonPath('data.0.id', $linked->id);
        $this->getJson('/api/v1/users/linkable-people?search=Available')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/users/linkable-people?id='.$inactive->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/users/linkable-people?id='.$deleted->id)->assertOk()->assertJsonCount(0, 'data');

        $actor = $this->operator(['users.view']);
        $this->actingAs($actor)->getJson('/api/v1/users/linkable-people')->assertForbidden();
        $actor = $this->operator(['people.view'], 'People viewer');
        $this->actingAs($actor)->getJson('/api/v1/users/linkable-people')->assertForbidden();
    }

    public function test_person_links_can_be_changed_cleared_and_disabled_without_duplicating_or_deleting_identities(): void
    {
        $this->administrator();
        $first = Person::factory()->create();
        $second = Person::factory()->create();
        $inactive = Person::factory()->create(['status' => false]);
        $role = Role::factory()->create();
        $payload = ['name' => 'Linked account', 'username' => 'linked.account', 'role_id' => $role->id, 'person_id' => $first->id, 'company_ids' => [], 'status' => true, 'password' => 'temporary-password-12', 'password_confirmation' => 'temporary-password-12'];
        $account = $this->postJson('/api/v1/users', $payload)->assertCreated()->assertJsonPath('data.person_name', $first->name)->json('data');
        $this->postJson('/api/v1/users', array_replace($payload, ['username' => 'duplicate.link']))->assertUnprocessable()->assertJsonValidationErrors('person_id');
        $this->postJson('/api/v1/users', array_replace($payload, ['username' => 'inactive.link', 'person_id' => $inactive->id]))->assertUnprocessable()->assertJsonValidationErrors('person_id');
        unset($payload['password'], $payload['password_confirmation']);
        $url = '/api/v1/users/'.$account['id'];
        $account = $this->putJson($url, array_replace($payload, ['version' => $account['version'], 'person_id' => $second->id]))->assertOk()->assertJsonPath('data.person_id', $second->id)->json('data');
        $this->getJson('/api/v1/users/linkable-people?id='.$first->id)->assertOk()->assertJsonCount(1, 'data');
        $this->putJson($url, array_replace($payload, ['version' => 1, 'person_id' => null]))->assertConflict();
        $account = $this->putJson($url, array_replace($payload, ['version' => $account['version'], 'person_id' => null]))->assertOk()->assertJsonPath('data.person_id', null)->json('data');
        $account = $this->putJson($url, array_replace($payload, ['version' => $account['version'], 'person_id' => $second->id, 'status' => false]))->assertOk()->assertJsonPath('data.status', false)->json('data');
        $this->getJson('/api/v1/users/linkable-people?id='.$second->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/users?context=management&id='.$account['id'])->assertOk()->assertJsonPath('data.0.status', false);
        $second->update(['status' => false]);
        $this->putJson($url, array_replace($payload, ['version' => $account['version'], 'person_id' => $second->id, 'status' => false]))->assertOk();
        $this->assertDatabaseCount('people', 3);
        $this->assertDatabaseHas('audit_events', ['entity' => 'users', 'record_id' => $account['id'], 'action' => 'update']);
    }

    public function test_link_changes_require_person_access_and_link_lookup_respects_account_management_scope(): void
    {
        $super = $this->administrator();
        $person = Person::factory()->create();
        $role = Role::factory()->create();
        $target = User::factory()->create(['role_id' => $role->id])->refresh();
        $actor = $this->operator(['users.view', 'users.update']);
        $this->actingAs($actor);
        $payload = ['name' => $target->name, 'username' => $target->username, 'role_id' => $role->id, 'person_id' => $person->id, 'company_ids' => [], 'status' => true, 'version' => $target->version];
        $this->putJson('/api/v1/users/'.$target->id, $payload)->assertForbidden();
        $actor = $this->operator(['users.view', 'people.view'], 'Link viewer');
        $this->actingAs($actor)->getJson('/api/v1/users/linkable-people?user_id='.$super->id)->assertNotFound();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'person_id' => null]);
    }

    public function test_legacy_setup_flags_do_not_block_active_accounts_and_are_not_exposed(): void
    {
        $user = $this->administrator();
        $user->update(['must_change_password' => true, 'two_factor_secret' => encrypt('legacy-secret'), 'two_factor_confirmed_at' => now()]);
        $this->getJson('/api/v1/companies')->assertOk();
        $this->getJson('/api/v1/session')->assertOk()->assertJsonMissingPath('user.must_change_password')->assertJsonMissingPath('user.requires_two_factor')->assertJsonMissingPath('user.two_factor_enabled')->assertJsonMissingPath('user.two_factor_pending');
        $this->getJson('/api/v1/users?context=management')->assertOk()->assertJsonMissingPath('data.0.two_factor_enabled');
        $user->update(['status' => false]);
        $this->getJson('/api/v1/session')->assertUnauthorized();
    }

    public function test_setup_and_self_service_password_endpoints_are_unavailable(): void
    {
        $this->administrator();
        $this->assertSame([], config('fortify.features'));
        $this->assertFalse(Route::has('two-factor.login.store'));
        $this->assertFalse(Route::has('user-password.update'));
        $this->postJson('/user/two-factor-authentication')->assertNotFound();
        $this->getJson('/user/two-factor-qr-code')->assertNotFound();
        $this->getJson('/user/two-factor-recovery-codes')->assertNotFound();
        $this->putJson('/user/password', ['password' => 'Unwanted-password-123'])->assertNotFound();
    }
}
