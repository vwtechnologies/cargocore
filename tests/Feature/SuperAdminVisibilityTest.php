<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\BankOfficer;
use App\Models\Company;
use App\Models\Document;
use App\Models\Person;
use App\Models\PersonBankAccount;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\PersonContact;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\ErpTestCase;

class SuperAdminVisibilityTest extends ErpTestCase
{
    public function test_admin_can_read_masters_and_linked_records_created_through_super_admin_apis(): void
    {
        $this->administrator();
        $company = $this->createRecord('companies', ['name' => 'Owner-created company']);
        $person = $this->createRecord('people', ['name' => 'Owner-created person']);
        $country = $this->createRecord('countries', ['name' => 'Owner-created country']);
        $bank = $this->createRecord('banks', ['name' => 'Owner-created bank', 'country_id' => $country['id']]);
        $marka = $this->createRecord('markas', ['code' => 'OWNER-MARK', 'description' => 'Owner-created mark']);
        $type = $this->createRecord('employee-types', ['name' => 'Owner-created employee type']);
        $role = $this->createRecord('business-types', ['name' => 'Owner-created business role']);
        $paths = ['companies' => $company, 'people' => $person, 'countries' => $country, 'banks' => $bank, 'markas' => $marka, 'employee-types' => $type, 'business-types' => $role];
        $paths['countries/'.$country['id'].'/cities'] = $city = $this->createRecord('countries/'.$country['id'].'/cities', ['name' => 'Owner-created city']);
        $paths['banks/'.$bank['id'].'/branches'] = $this->createRecord('banks/'.$bank['id'].'/branches', ['name' => 'Owner-created branch', 'country_id' => $country['id'], 'city_id' => $city['id']]);
        $paths['banks/'.$bank['id'].'/officers'] = $this->createRecord('banks/'.$bank['id'].'/officers', ['person_id' => $person['id'], 'designation' => 'Officer']);
        $paths['companies/'.$company['id'].'/sub-companies'] = $this->createRecord('companies/'.$company['id'].'/sub-companies', ['name' => 'Owner-created sub-company']);
        $paths['people/'.$person['id'].'/contacts'] = $this->createRecord('people/'.$person['id'].'/contacts', ['phone' => '051-5551234']);
        $paths['people/'.$person['id'].'/person-markas'] = $this->createRecord('people/'.$person['id'].'/person-markas', ['marka_id' => $marka['id']]);
        $paths['people/'.$person['id'].'/associations'] = $association = $this->createRecord('people/'.$person['id'].'/associations', ['company_id' => $company['id']]);
        $paths['associations/'.$association['id'].'/classifications'] = $this->createRecord('associations/'.$association['id'].'/classifications', ['business_type_id' => $role['id'], 'opening_balance' => '12500.00']);
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $admin->companies()->attach($company['id']);
        $this->actingAs($admin);
        foreach ($paths as $path => $record) {
            $this->getJson('/api/v1/'.$path.'/'.$record['id'].'?context=management')->assertOk()->assertJsonPath('data.id', $record['id']);
        }
        $this->getJson('/api/v1/audit')->assertForbidden();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonCount(0, 'recent_activity');
    }

    public function test_admin_cannot_list_search_assign_or_modify_super_admin_accounts_or_roles(): void
    {
        $super = $this->administrator()->refresh();
        $hiddenPerson = Person::factory()->create(['name' => 'Private owner identity']);
        $super->update(['person_id' => $hiddenPerson->id, 'name' => 'Private owner account']);
        $disabledSuper = User::factory()->create(['role_id' => $super->role_id, 'status' => false]);
        $company = Company::factory()->create();
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $admin->companies()->attach($company);
        $subordinateRole = Role::factory()->create();
        $subordinate = User::factory()->create(['role_id' => $subordinateRole->id]);
        $this->actingAs($admin);

        foreach (['', '?context=management', '?context=lookup', '?context=management&search=Private%20owner', '?context=management&id='.$super->id, '?person_id='.$hiddenPerson->id] as $query) {
            $response = $this->getJson('/api/v1/users'.$query)->assertOk();
            $this->assertNotContains($super->id, array_column($response->json('data'), 'id'));
            $this->assertNotContains($disabledSuper->id, array_column($response->json('data'), 'id'));
            $this->assertStringNotContainsString('Super Admin', $response->getContent());
        }
        $this->getJson('/api/v1/users?context=management&id='.$subordinate->id)->assertOk()->assertJsonPath('data.0.id', $subordinate->id);
        foreach (['', '?context=lookup', '?id='.$super->role_id] as $query) {
            $response = $this->getJson('/api/v1/roles'.$query)->assertOk();
            $this->assertNotContains($super->role_id, array_column($response->json('data'), 'id'));
            $this->assertStringNotContainsString('Super Admin', $response->getContent());
            $this->assertSame([], $response->json('permissions'));
        }
        $this->getJson('/api/v1/roles?context=management')->assertForbidden();
        $this->getJson('/api/v1/roles/'.$super->role_id)->assertNotFound();
        $this->getJson('/api/v1/users/'.$super->id)->assertNotFound();
        $this->getJson('/api/v1/people/'.$hiddenPerson->id.'/user-account')->assertNotFound();
        $this->getJson('/api/v1/users/linkable-people?user_id='.$super->id)->assertNotFound();
        $this->putJson('/api/v1/users/'.$super->id, [])->assertNotFound();
        $this->putJson('/api/v1/users/'.$disabledSuper->id, [])->assertNotFound();
        $this->putJson('/api/v1/roles/'.$super->role_id, ['name' => 'Changed'])->assertForbidden();
        $this->postJson('/api/v1/roles', ['name' => 'New role', 'permissions' => [], 'status' => true])->assertForbidden();
        $response = $this->postJson('/api/v1/users', ['name' => 'Escalation', 'username' => 'escalation', 'role_id' => $super->role_id, 'company_ids' => [$company->id], 'status' => true, 'password' => 'Assigned-password-123', 'password_confirmation' => 'Assigned-password-123'])->assertForbidden();
        $this->assertStringNotContainsString('Super Admin', $response->getContent());
        $this->assertDatabaseMissing('users', ['username' => 'escalation']);
        $this->actingAs($super)->getJson('/api/v1/users?context=management&id='.$disabledSuper->id)->assertOk()->assertJsonPath('data.0.id', $disabledSuper->id);
        $this->getJson('/api/v1/roles?context=management')->assertOk()->assertJsonFragment(['name' => 'Super Admin']);
    }

    public function test_admin_can_read_person_business_details_while_the_linked_super_admin_account_stays_hidden(): void
    {
        Storage::fake('local');
        $super = $this->administrator();
        $person = Person::factory()->create();
        $super->update(['person_id' => $person->id]);
        $ordinary = Person::factory()->create();
        $company = Company::factory()->create();
        $contact = PersonContact::factory()->create(['person_id' => $person->id]);
        $account = PersonBankAccount::factory()->create(['person_id' => $person->id]);
        $officer = BankOfficer::factory()->create(['person_id' => $person->id]);
        $association = PersonCompany::factory()->create(['person_id' => $person->id, 'company_id' => $company->id]);
        $assignment = PersonClassification::factory()->create(['person_company_id' => $association->id]);
        $document = Document::create(['person_id' => $person->id, 'kind' => 'identification', 'original_name' => 'private.pdf', 'path' => 'private.pdf', 'mime_type' => 'application/pdf', 'size' => 1, 'sha256' => hash('sha256', 'x')]);
        Storage::disk('local')->put('private.pdf', 'x');
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $admin->companies()->attach($company);
        $this->actingAs($admin);
        $this->getJson('/api/v1/people?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/people?id='.$person->id.'&context=lookup')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/people/'.$person->id.'?context=management')->assertOk()->assertJsonMissingPath('data.user');
        $this->putJson('/api/v1/people/'.$person->id, ['name' => 'Updated business identity', 'version' => 1])->assertOk();
        foreach (['contacts' => $contact, 'accounts' => $account, 'officers' => $officer, 'associations' => $association, 'classifications' => $assignment] as $entity => $record) {
            $this->getJson('/api/v1/'.$entity.'?context=management')->assertOk()->assertJsonCount(1, 'data');
            $this->getJson('/api/v1/'.$entity.'/'.$record->id.'?context=management')->assertOk();
        }
        foreach (['contacts', 'accounts', 'associations', 'documents', 'employee', 'company-roles/'.$company->id] as $child) {
            $this->getJson('/api/v1/people/'.$person->id.'/'.$child.'?context=management')->assertOk();
        }
        $this->getJson('/api/v1/people/'.$person->id.'/documents/'.$document->id.'/download?context=management')->assertOk();
        $this->getJson('/api/v1/people/'.$person->id.'/user-account')->assertNotFound();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('counts.people.total', 2)->assertJsonCount(2, 'recent_people');
        $this->actingAs($super)->getJson('/api/v1/people/'.$person->id.'?context=management')->assertOk()->assertJsonPath('data.id', $person->id);
    }

    public function test_admin_cannot_read_audit_logs_while_super_admin_can_read_all_activity(): void
    {
        $super = $this->administrator();
        $person = Person::factory()->create(['name' => 'Owner business identity']);
        $super->update(['person_id' => $person->id, 'name' => 'Private owner account']);
        $company = Company::factory()->create();
        $outside = Company::factory()->create();
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $admin->companies()->attach($company);
        $business = AuditEvent::create(['user_id' => $super->id, 'entity' => 'companies', 'record_id' => $company->id, 'record_label' => 'Company created by owner', 'company_id' => $company->id, 'action' => 'create', 'ip_address' => '192.0.2.10', 'changes' => []]);
        $identity = AuditEvent::create(['user_id' => $admin->id, 'entity' => 'people', 'record_id' => $person->id, 'record_label' => $person->name, 'action' => 'update', 'changes' => []]);
        $visible = AuditEvent::create(['user_id' => $admin->id, 'entity' => 'companies', 'record_id' => $company->id, 'company_id' => $company->id, 'action' => 'update', 'changes' => []]);
        $privateAccount = AuditEvent::create(['user_id' => $super->id, 'entity' => 'users', 'record_id' => $super->id, 'record_label' => $super->name, 'action' => 'create', 'changes' => []]);
        AuditEvent::create(['user_id' => $super->id, 'entity' => 'roles', 'record_id' => $super->role_id, 'record_label' => 'Super Admin', 'action' => 'update', 'changes' => []]);
        AuditEvent::create(['user_id' => $super->id, 'entity' => 'companies', 'record_id' => $outside->id, 'company_id' => $outside->id, 'action' => 'update', 'changes' => []]);
        $this->actingAs($admin);
        $this->getJson('/api/v1/audit')->assertForbidden();
        $this->getJson('/api/v1/audit?user_id='.$super->id)->assertForbidden();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonCount(0, 'recent_activity');
        $this->actingAs($super);
        $response = $this->getJson('/api/v1/audit')->assertOk();
        $ids = array_column($response->json('data'), 'id');
        $this->assertContains($business->id, $ids);
        $this->assertContains($identity->id, $ids);
        $this->assertContains($privateAccount->id, $ids);
        $this->assertSame($super->id, collect($response->json('data'))->firstWhere('id', $business->id)['actor']['id']);
    }

    public function test_admin_can_assign_the_admin_role_but_cannot_expose_or_assign_super_admin(): void
    {
        $this->administrator();
        $company = Company::factory()->create();
        $role = Role::where('name', 'Admin')->firstOrFail();
        $admin = User::factory()->create(['role_id' => $role->id]);
        $admin->companies()->attach($company);
        $this->actingAs($admin);
        $this->getJson('/api/v1/roles')->assertOk()->assertJsonFragment(['name' => 'Admin'])->assertJsonMissing(['name' => 'Super Admin']);
        $peer = $this->createRecord('users', ['name' => 'Client Admin Colleague', 'username' => 'admin.colleague', 'role_id' => $role->id, 'company_ids' => [$company->id], 'status' => true, 'password' => 'Assigned-password-123', 'password_confirmation' => 'Assigned-password-123']);
        $this->getJson('/api/v1/users?id='.$peer['id'].'&context=management')->assertOk()->assertJsonPath('data.0.role_name', 'Admin');
        $this->putJson('/api/v1/users/'.$peer['id'], ['name' => 'Updated colleague', 'username' => 'admin.colleague', 'role_id' => $role->id, 'company_ids' => [$company->id], 'status' => true, 'version' => 1])->assertOk();
        $custom = $this->operator(['users.view', 'users.create'], 'User manager');
        $custom->companies()->attach($company);
        $this->actingAs($custom)->postJson('/api/v1/users', ['name' => 'Escalation', 'username' => 'cannot.escalate', 'role_id' => $role->id, 'company_ids' => [$company->id], 'status' => true, 'password' => 'Assigned-password-123', 'password_confirmation' => 'Assigned-password-123'])->assertForbidden();
    }
}
