<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Person;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\ErpTestCase;

class DocumentsAndAuthenticationTest extends ErpTestCase
{
    public function test_anonymous_sessions_can_refresh_csrf_tokens_without_disabling_login_protection(): void
    {
        $user = User::factory()->create(['password' => 'Assigned-password-123', 'role_id' => Role::factory()->create()->id]);
        $this->app->instance('env', 'production');

        $response = $this->getJson('/csrf-token')->assertOk();
        $token = $response->json('token');
        $this->assertIsString($token);
        $this->assertNotEmpty($token);
        $response->assertSessionHas('_token', $token);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertGuest();

        $credentials = ['username' => $user->username, 'password' => 'Assigned-password-123'];
        $this->postJson('/login', $credentials, ['X-CSRF-TOKEN' => 'expired-token'])->assertStatus(419);
        $this->assertGuest();
        $token = $this->getJson('/csrf-token')->assertOk()->json('token');
        $this->postJson('/login', $credentials, ['X-CSRF-TOKEN' => $token])->assertOk();
        $this->assertAuthenticatedAs($user);
    }

    public function test_private_uploads_are_reencoded_and_authorized_on_each_download(): void
    {
        Storage::fake('local');
        $this->administrator();
        $person = Person::factory()->create();
        $other = Person::factory()->create();
        $response = $this->postJson('/api/v1/people/'.$person->id.'/documents', ['kind' => 'profile', 'file' => UploadedFile::fake()->image('photo.jpg', 100, 100)])->assertCreated()->assertJsonMissingPath('data.path')->assertJsonPath('data.mime_type', 'image/png');
        $doc = Document::findOrFail($response->json('data.id'));
        Storage::disk('local')->assertExists($doc->path);
        $this->get('/api/v1/people/'.$person->id.'/documents/'.$doc->id.'/download?inline=1')->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->getJson('/api/v1/people/'.$other->id.'/documents/'.$doc->id.'/download')->assertNotFound();
        $this->postJson('/api/v1/people/'.$person->id.'/documents', ['kind' => 'identification', 'file' => UploadedFile::fake()->create('payload.php', 1, 'text/x-php')])->assertUnprocessable();
        $viewer = $this->operator(['people.view']);
        $this->actingAs($viewer);
        $this->getJson('/api/v1/people/'.$person->id.'/documents/'.$doc->id.'/download')->assertForbidden();
    }

    public function test_replacing_a_document_rejects_stale_versions_and_preserves_old_file(): void
    {
        Storage::fake('local');
        $this->administrator();
        $person = Person::factory()->create();
        $doc = $this->postJson('/api/v1/people/'.$person->id.'/documents', ['kind' => 'signature', 'file' => UploadedFile::fake()->image('sign.png')])->assertCreated()->json('data');
        $path = Document::findOrFail($doc['id'])->path;
        $this->postJson('/api/v1/people/'.$person->id.'/documents/'.$doc['id'], ['kind' => 'signature', 'version' => 0, 'file' => UploadedFile::fake()->image('wrong.png')])->assertConflict();
        Storage::disk('local')->assertExists($path);
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->postJson('/api/v1/people/'.$person->id.'/documents/'.$doc['id'], ['kind' => 'signature', 'version' => 1, 'file' => UploadedFile::fake()->image('new.png')])->assertOk()->assertJsonPath('data.version', 2);
        Storage::disk('local')->assertExists($path);
    }

    public function test_administrators_with_legacy_setup_flags_sign_in_using_only_the_assigned_password(): void
    {
        $this->seed(DatabaseSeeder::class);
        foreach (['Super Admin', 'Admin'] as $index => $name) {
            $user = User::factory()->create(['username' => 'direct.admin.'.$index, 'password' => 'Assigned-password-123', 'role_id' => Role::where('name', $name)->firstOrFail()->id, 'must_change_password' => true, 'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'), 'two_factor_recovery_codes' => encrypt(json_encode(['old-code'])), 'two_factor_confirmed_at' => now()]);
            $this->postJson('/login', ['username' => $user->username, 'password' => 'Assigned-password-123'])->assertOk();
            $this->assertAuthenticatedAs($user);
            $this->getJson('/api/v1/companies')->assertOk();
            $this->postJson('/logout')->assertNoContent();
            $this->assertGuest();
        }
    }

    public function test_administrator_password_reset_revokes_sessions_and_the_assigned_password_works_directly(): void
    {
        $this->administrator();
        $user = User::factory()->create(['password' => 'Original-password-123', 'role_id' => Role::factory()->create()->id])->refresh();
        DB::table('sessions')->insert(['id' => 'other-session', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
        $this->putJson('/api/v1/users/'.$user->id, ['name' => $user->name, 'username' => $user->username, 'role_id' => $user->role_id, 'company_ids' => [], 'status' => true, 'version' => $user->version, 'password' => 'Replacement-password-456', 'password_confirmation' => 'Replacement-password-456'])->assertOk();
        $this->assertFalse($user->fresh()->must_change_password);
        $this->assertTrue(Hash::check('Replacement-password-456', $user->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['id' => 'other-session']);
        $this->assertDatabaseHas('audit_events', ['action' => 'password_reset', 'record_id' => $user->id]);
        $this->postJson('/logout')->assertNoContent();
        Auth::forgetGuards();
        $this->postJson('/login', ['username' => $user->username, 'password' => 'Replacement-password-456'])->assertOk();
        $this->assertAuthenticatedAs($user);
        $this->getJson('/api/v1/session')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_disabled_accounts_cannot_sign_in_and_registration_is_unavailable(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->create(['password' => 'Password-long-123', 'role_id' => Role::where('name', 'Admin')->firstOrFail()->id, 'status' => false]);
        $this->postJson('/login', ['username' => $user->username, 'password' => 'Password-long-123'])->assertUnprocessable();
        $this->assertGuest();
        $this->postJson('/register', ['name' => 'Public User'])->assertStatus(405);
    }

    public function test_login_rejects_incorrect_passwords_and_throttles_repeated_attempts(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->create(['password' => 'Assigned-password-123', 'role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/login', ['username' => $user->username, 'password' => 'Wrong-password-456'])->assertUnprocessable();
        }
        $this->postJson('/login', ['username' => $user->username, 'password' => 'Wrong-password-456'])->assertTooManyRequests();
        $this->assertGuest();
    }
}
