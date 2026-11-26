<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\ErpTestCase;

class TextCaseTest extends ErpTestCase
{
    public function test_text_is_stored_exactly_as_typed_and_dropdown_values_use_the_option_spelling(): void
    {
        $this->administrator();
        $country = $this->createRecord('countries', ['name' => 'Mixed Country', 'short_name' => 'mC', 'status' => true]);
        $this->assertSame('Mixed Country', $country['name']);
        $this->assertSame('mC', $country['short_name']);

        $person = $this->createRecord('people', ['name' => 'Straße Ali', 'father_husband_name' => 'Mixed Father', 'gender' => 'feMALE', 'comments' => 'My Notes']);
        $this->assertSame('Straße Ali', $person['name']);
        $this->assertSame('Female', $person['gender']);
        $this->assertSame('My Notes', $person['comments']);
        $this->assertDatabaseHas('people', ['id' => $person['id'], 'name' => 'Straße Ali']);

        $company = $this->createRecord('companies', ['name' => 'Mixed Company', 'type' => 'private limited', 'website' => 'https://example.test/CaseSensitive']);
        $this->assertSame('Mixed Company', $company['name']);
        $this->assertSame('Private Limited', $company['type']);
        $this->assertSame('https://example.test/CaseSensitive', $company['website']);

        $marka = $this->createRecord('markas', ['code' => 'Mark-xyz', 'description' => 'Uneven Case']);
        $this->assertSame('Mark-xyz', $marka['code']);
        $this->putJson('/api/v1/markas/'.$marka['id'], ['code' => 'Mark-xyz', 'description' => 'new description', 'version' => $marka['version']])
            ->assertOk()
            ->assertJsonPath('data.description', 'new description');
    }

    public function test_users_and_roles_keep_their_spelling_and_usernames_sign_in_in_any_case(): void
    {
        $this->administrator();
        $this->postJson('/api/v1/roles', ['name' => 'Data Entry', 'status' => true, 'permissions' => []])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Data Entry');
        $this->postJson('/api/v1/users', ['name' => 'Mixed User', 'username' => 'Mixed.User', 'email' => 'Mixed.User@example.test', 'role_id' => Role::where('name', 'USER')->firstOrFail()->id, 'company_ids' => [], 'status' => true, 'password' => 'CaseSensitive-Password-123', 'password_confirmation' => 'CaseSensitive-Password-123'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Mixed User')
            ->assertJsonPath('data.username', 'Mixed.User')
            ->assertJsonPath('data.email', 'Mixed.User@example.test');
        $this->postJson('/api/v1/users', ['name' => 'Twin', 'username' => 'MIXED.USER', 'role_id' => Role::where('name', 'USER')->firstOrFail()->id, 'company_ids' => [], 'status' => true, 'password' => 'CaseSensitive-Password-123', 'password_confirmation' => 'CaseSensitive-Password-123'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('username');
        $user = User::where('username', 'Mixed.User')->firstOrFail();
        $this->assertTrue(Hash::check('CaseSensitive-Password-123', $user->password));

        $this->postJson('/logout')->assertNoContent();
        Auth::forgetGuards();
        $this->postJson('/login', ['username' => 'mixed.user', 'password' => 'CASESENSITIVE-PASSWORD-123'])->assertUnprocessable();
        $this->assertGuest();
        foreach (['mixed.user', 'MIXED.USER', 'Mixed.User'] as $username) {
            $this->postJson('/login', ['username' => $username, 'password' => 'CaseSensitive-Password-123'])->assertOk();
            $this->assertAuthenticatedAs($user);
            $this->postJson('/logout')->assertNoContent();
            Auth::forgetGuards();
        }
    }
}
