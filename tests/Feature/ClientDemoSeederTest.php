<?php

namespace Tests\Feature;

use App\Models\Bank;
use App\Models\Company;
use App\Models\Country;
use App\Models\EmployeeType;
use App\Models\Marka;
use App\Models\Permission;
use App\Models\Person;
use App\Models\PersonBankAccount;
use App\Models\PersonMarka;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\ClientDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\UserRoleSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\ErpTestCase;

class ClientDemoSeederTest extends ErpTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['demo.admin_password' => 'Demo-admin-test-123', 'demo.super_password' => 'Demo-super-test-123']);
    }

    public function test_client_demo_contains_both_logins_linked_ali_and_representative_active_and_inactive_data(): void
    {
        $this->seed(ClientDemoSeeder::class);
        $ali = User::where('username', 'ALI')->firstOrFail();
        $saath = User::where('username', 'SAATH')->firstOrFail();
        $this->assertDatabaseCount('users', 2);
        $this->assertSame('Admin', $ali->role->name);
        $this->assertSame('ALI', $ali->person->name);
        $this->assertNull($saath->person_id);
        $this->assertSame('Super Admin', $saath->role->name);
        $this->assertTrue(Hash::check('Demo-admin-test-123', $ali->password));
        $this->assertTrue(Hash::check('Demo-super-test-123', $saath->password));
        foreach ([$ali, $saath] as $user) {
            $this->assertFalse($user->must_change_password);
            $this->assertNull($user->two_factor_secret);
            $this->assertNull($user->two_factor_confirmed_at);
        }
        foreach ([Company::class, Country::class, Bank::class, Person::class, EmployeeType::class, Marka::class, PersonBankAccount::class] as $model) {
            $this->assertTrue($model::where('status', true)->exists(), $model.' needs an active example');
            $this->assertTrue($model::where('status', false)->exists(), $model.' needs an inactive example');
        }
        $this->assertSame(1, Company::where('is_default', true)->count());
        $this->assertSame(2, PersonMarka::where('person_id', $ali->person_id)->count());
        $this->assertSame(2, $ali->companies()->count());
        $this->assertSame(3, $saath->companies()->count());
        $this->assertTrue(PersonBankAccount::where('status', true)->get()->every(fn (PersonBankAccount $account): bool => $account->person->status && $account->branch->status && $account->branch->bank->status));
    }

    public function test_demo_credentials_sign_in_without_reset_or_mfa_and_admin_cannot_access_audit_or_super_accounts(): void
    {
        $this->seed(ClientDemoSeeder::class);
        foreach (['Ali' => 'Demo-admin-test-123', 'Saath' => 'Demo-super-test-123'] as $username => $password) {
            $this->postJson('/login', compact('username', 'password'))->assertOk();
            $this->getJson('/api/v1/session')->assertOk()->assertJsonPath('user.username', strtoupper($username));
            $this->postJson('/logout')->assertNoContent();
            Auth::forgetGuards();
        }
        $ali = User::where('username', 'ALI')->firstOrFail();
        $saath = User::where('username', 'SAATH')->firstOrFail();
        $this->actingAs($ali);
        $this->getJson('/api/v1/audit')->assertForbidden();
        $this->getJson('/api/v1/roles?context=management')->assertForbidden();
        $this->getJson('/api/v1/roles?context=lookup')->assertOk()->assertJsonMissing(['name' => 'Super Admin']);
        $this->getJson('/api/v1/users?context=management')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.username', 'ALI');
        $this->getJson('/api/v1/people?context=management')->assertOk()->assertJsonCount(6, 'data');
        $this->getJson('/api/v1/people/'.$ali->person_id.'/accounts?context=management')->assertOk()->assertJsonCount(1, 'data');
        $this->assertFalse($ali->permits('audit.view'));
        $this->actingAs($saath);
        $this->getJson('/api/v1/audit')->assertOk()->assertJsonFragment(['entity' => 'companies']);
        $this->getJson('/api/v1/roles?context=management')->assertOk();
        $this->getJson('/api/v1/users?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing(UserRoleSeeder::permissions(), Role::where('name', 'USER')->firstOrFail()->permissions->pluck('name')->all());
    }

    public function test_role_export_preserves_custom_read_only_and_result_permissions_in_the_demo(): void
    {
        $this->seed(DatabaseSeeder::class);
        $readOnly = Role::factory()->create(['name' => 'READ-ONLY']);
        $readOnly->permissions()->sync(Permission::whereIn('name', ['companies.view', 'geography.view', 'banks.view'])->pluck('id'));
        $result = Role::factory()->create(['name' => 'RESULT']);
        $result->permissions()->sync(Permission::whereIn('name', ['people.view', 'markas.view'])->pluck('id'));
        $path = sys_get_temp_dir().'/cargocore-roles-'.Str::random(12).'.json';
        try {
            $this->artisan('erp:export-demo-roles', ['path' => $path])->assertSuccessful();
            config(['demo.role_profiles' => $path]);
            $this->seed(ClientDemoSeeder::class);
            $this->assertEqualsCanonicalizing(['companies.view', 'geography.view', 'banks.view'], $readOnly->fresh()->permissions->pluck('name')->all());
            $this->assertEqualsCanonicalizing(['people.view', 'markas.view'], $result->fresh()->permissions->pluck('name')->all());
        } finally {
            File::delete($path);
        }
    }

    public function test_demo_refuses_to_overwrite_an_existing_business_database(): void
    {
        $person = Person::factory()->create();
        try {
            $this->seed(ClientDemoSeeder::class);
            $this->fail('Existing business data must not be overwritten.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('empty business database', $exception->getMessage());
        }
        $this->assertDatabaseCount('people', 1);
        $this->assertSame($person->name, $person->fresh()->name);
        $this->assertDatabaseCount('users', 0);
    }
}
