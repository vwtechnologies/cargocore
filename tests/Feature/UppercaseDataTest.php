<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\ErpTestCase;

class UppercaseDataTest extends ErpTestCase
{
    public function test_text_usernames_emails_and_urls_are_uppercase_before_validation_and_persistence_while_passwords_keep_their_case(): void
    {
        $this->administrator();
        $country = $this->createRecord('countries', ['name' => 'Mixed Country', 'short_name' => 'mC', 'status' => true]);
        $this->assertSame('MIXED COUNTRY', $country['name']);
        $this->assertSame('MC', $country['short_name']);
        $person = $this->createRecord('people', ['name' => 'Straße Ali', 'father_husband_name' => 'Mixed Father', 'gender' => 'feMale', 'comments' => 'My Notes']);
        $this->assertSame('STRASSE ALI', $person['name']);
        $this->assertSame('FEMALE', $person['gender']);
        $this->assertSame('MY NOTES', $person['comments']);
        $company = $this->createRecord('companies', ['name' => 'Mixed Company', 'website' => 'https://example.test/CaseSensitive', 'address' => 'Street no one']);
        $this->assertSame('HTTPS://EXAMPLE.TEST/CASESENSITIVE', $company['website']);
        $this->assertSame('STREET NO ONE', $company['address']);
        $marka = $this->createRecord('markas', ['code' => 'Mark-xyz', 'description' => 'Uneven Case']);
        $this->assertSame('MARK-XYZ', $marka['code']);
        $this->putJson('/api/v1/markas/'.$marka['id'], ['code' => 'mark-xyz', 'description' => 'new description', 'version' => $marka['version']])->assertOk()->assertJsonPath('data.description', 'NEW DESCRIPTION');
        $this->postJson('/api/v1/users', ['name' => 'Mixed User', 'username' => 'mixed.user', 'email' => 'Mixed.User@example.test', 'role_id' => Role::where('name', 'USER')->firstOrFail()->id, 'company_ids' => [], 'status' => true, 'password' => 'CaseSensitive-Password-123', 'password_confirmation' => 'CaseSensitive-Password-123'])->assertCreated()->assertJsonPath('data.name', 'MIXED USER')->assertJsonPath('data.username', 'MIXED.USER')->assertJsonPath('data.email', 'MIXED.USER@EXAMPLE.TEST');
        $this->assertTrue(Hash::check('CaseSensitive-Password-123', User::where('username', 'mixed.user')->firstOrFail()->password));
        $this->assertDatabaseHas('people', ['id' => $person['id'], 'name' => 'STRASSE ALI']);
        $this->postJson('/api/v1/people', ['name' => str_repeat('ß', 200)])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/logout')->assertNoContent();
        Auth::forgetGuards();
        $this->postJson('/login', ['username' => 'MiXeD.UsEr', 'password' => 'CASESENSITIVE-PASSWORD-123'])->assertUnprocessable();
        $this->assertGuest();
        foreach (['mixed.user', 'MIXED.USER'] as $username) {
            $this->postJson('/login', ['username' => $username, 'password' => 'CaseSensitive-Password-123'])->assertOk();
            $this->assertAuthenticatedAs(User::where('username', 'MIXED.USER')->firstOrFail());
            $this->postJson('/logout')->assertNoContent();
            Auth::forgetGuards();
        }
    }

    public function test_existing_data_conversion_is_audited_versioned_idempotent_and_preserves_system_roles(): void
    {
        $owner = $this->administrator();
        $company = Company::factory()->create(['name' => 'Mixed Existing', 'website' => 'https://example.test/KeepCase']);
        $password = $owner->password;
        $this->artisan('erp:uppercase-data')->assertSuccessful();
        $this->assertSame('MIXED EXISTING', $company->refresh()->name);
        $this->assertSame('HTTPS://EXAMPLE.TEST/KEEPCASE', $company->website);
        $this->assertSame(mb_strtoupper($owner->username), $owner->refresh()->username);
        $this->assertSame(mb_strtoupper($owner->email), $owner->email);
        $this->assertSame($password, $owner->refresh()->password);
        $this->assertTrue($owner->isSuperAdmin());
        $this->assertDatabaseHas('roles', ['name' => 'Admin', 'is_system' => true]);
        $this->assertDatabaseHas('audit_events', ['entity' => 'companies', 'record_id' => $company->id, 'action' => 'uppercase']);
        $version = $company->version;
        $audits = AuditEvent::count();
        $this->artisan('erp:uppercase-data')->assertSuccessful();
        $this->assertSame($version, $company->refresh()->version);
        $this->assertSame($audits, AuditEvent::count());
    }
}
