<?php

namespace Tests\Feature;

use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\BankOfficer;
use App\Models\BusinessType;
use App\Models\City;
use App\Models\Company;
use App\Models\Country;
use App\Models\Person;
use App\Models\PersonBankAccount;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\PersonContact;
use App\Models\Role;
use App\Models\SubCompany;
use App\Models\User;
use Tests\ErpTestCase;

class ActiveVisibilityTest extends ErpTestCase
{
    public function test_inactive_masters_remain_manageable_but_disappear_from_operational_lists_and_lookups(): void
    {
        $this->administrator();
        foreach (['countries' => ['name' => 'Hidden Country'], 'banks' => ['name' => 'Hidden Bank'], 'people' => ['name' => 'Hidden Person'], 'employee-types' => ['name' => 'Hidden Type'], 'business-types' => ['name' => 'Hidden Classification'], 'markas' => ['code' => 'HIDDEN', 'description' => 'Hidden MARKA']] as $entity => $fields) {
            $record = $this->createRecord($entity, $fields + ['status' => true]);
            $this->getJson('/api/v1/'.$entity.'?id='.$record['id'])->assertOk()->assertJsonCount(1, 'data');
            $this->putJson('/api/v1/'.$entity.'/'.$record['id'], $fields + ['status' => false, 'version' => $record['version']])->assertOk();
            foreach (['id='.$record['id'], 'ids='.$record['id'], 'status=0'] as $filter) {
                $this->getJson('/api/v1/'.$entity.'?'.$filter)->assertOk()->assertJsonCount(0, 'data');
            }
            $this->getJson('/api/v1/'.$entity.'/'.$record['id'])->assertNotFound();
            $this->getJson('/api/v1/'.$entity.'?position_of='.$record['id'])->assertNotFound();
            $this->getJson('/api/v1/'.$entity.'?context=management&id='.$record['id'])->assertOk()->assertJsonPath('data.0.status', false);
            $this->getJson('/api/v1/'.$entity.'/'.$record['id'].'?context=management')->assertOk()->assertJsonPath('data.status', false);
            $this->getJson('/api/v1/'.$entity.'?context=management&status=0&id='.$record['id'])->assertOk()->assertJsonCount(1, 'data');
            $this->getJson('/api/v1/'.$entity.'?context=management&id='.$record['id'].'&position_of='.$record['id'])->assertOk()->assertJsonPath('navigation.total', 1);
            $this->putJson('/api/v1/'.$entity.'/'.$record['id'], $fields + ['status' => true, 'version' => 2])->assertOk();
            $this->getJson('/api/v1/'.$entity.'?id='.$record['id'])->assertOk()->assertJsonCount(1, 'data');

        }
    }

    public function test_deactivating_a_country_hides_its_related_records_without_deleting_them(): void
    {
        $this->administrator();
        $country = Country::factory()->create();
        $city = City::factory()->create(['country_id' => $country->id]);
        $bank = Bank::factory()->create(['country_id' => $country->id]);
        $branch = BankBranch::factory()->create(['bank_id' => $bank->id, 'city_id' => $city->id]);
        $person = Person::factory()->create();
        $officer = BankOfficer::factory()->create(['bank_id' => $bank->id, 'bank_branch_id' => $branch->id, 'person_id' => $person->id]);
        $account = PersonBankAccount::factory()->create(['bank_branch_id' => $branch->id, 'person_id' => $person->id]);
        $this->putJson('/api/v1/countries/'.$country->id, ['name' => $country->name, 'status' => false, 'version' => $country->fresh()->version])->assertOk();
        foreach (['cities' => $city, 'banks' => $bank, 'branches' => $branch, 'officers' => $officer, 'accounts' => $account] as $entity => $record) {
            $this->getJson('/api/v1/'.$entity.'?id='.$record->id)->assertOk()->assertJsonCount(0, 'data');
            $this->getJson('/api/v1/'.$entity.'/'.$record->id)->assertNotFound();
            $this->assertTrue($record->fresh()->status);
            $this->getJson('/api/v1/'.$entity.'/'.$record->id.'?context=management')->assertOk();
        }
        $this->getJson('/api/v1/banks/'.$bank->id.'/branches')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_bank_country_reassignment_updates_scoped_lookups_and_hides_incompatible_branches(): void
    {
        $this->administrator();
        $china = Country::factory()->create(['name' => 'China']);
        $pakistan = Country::factory()->create(['name' => 'Pakistan']);
        $chineseCity = City::factory()->create(['country_id' => $china->id]);
        $pakistaniCity = City::factory()->create(['country_id' => $pakistan->id]);
        $bank = Bank::factory()->create(['country_id' => $china->id]);
        $oldBranch = BankBranch::factory()->create(['bank_id' => $bank->id, 'city_id' => $chineseCity->id]);
        $this->getJson('/api/v1/banks?country_id='.$china->id.'&id='.$bank->id)->assertOk()->assertJsonCount(1, 'data');
        $this->putJson('/api/v1/banks/'.$bank->id, ['name' => $bank->name, 'country_id' => $pakistan->id, 'version' => $bank->fresh()->version])->assertOk();
        $this->getJson('/api/v1/banks?country_id='.$china->id.'&id='.$bank->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/banks?country_id='.$pakistan->id.'&id='.$bank->id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/branches?id='.$oldBranch->id)->assertOk()->assertJsonCount(0, 'data');
        $this->assertDatabaseHas('bank_branches', ['id' => $oldBranch->id, 'city_id' => $chineseCity->id, 'status' => true]);
        $this->postJson('/api/v1/banks/'.$bank->id.'/branches', ['name' => 'Invalid China Office', 'city_id' => $chineseCity->id, 'country_id' => $china->id])->assertUnprocessable()->assertJsonValidationErrors('city_id');
        $newBranch = $this->createRecord('banks/'.$bank->id.'/branches', ['name' => 'Pakistan Office', 'city_id' => $pakistaniCity->id, 'country_id' => $pakistan->id]);
        $this->getJson('/api/v1/banks/'.$bank->id.'/branches')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $newBranch['id']);
        $globalBank = Bank::factory()->create();
        BankBranch::factory()->create(['bank_id' => $globalBank->id, 'city_id' => $chineseCity->id]);
        $this->getJson('/api/v1/banks?country_id='.$china->id.'&id='.$globalBank->id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/banks?country_id='.$pakistan->id.'&id='.$globalBank->id)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_inactive_people_companies_and_classifications_are_not_shown_through_children(): void
    {
        $this->administrator();
        $person = Person::factory()->create();
        $company = Company::factory()->create();
        $subCompany = SubCompany::factory()->create(['company_id' => $company->id]);
        $association = PersonCompany::factory()->create(['person_id' => $person->id, 'company_id' => $company->id]);
        $type = BusinessType::where('name', 'Customer')->firstOrFail();
        $classification = PersonClassification::factory()->create(['person_company_id' => $association->id, 'business_type_id' => $type->id]);
        $contact = PersonContact::factory()->create(['person_id' => $person->id]);
        $this->getJson('/api/v1/people?business_type_id='.$type->id)->assertOk()->assertJsonPath('data.0.id', $person->id);
        $this->putJson('/api/v1/companies/'.$company->id, ['name' => $company->name, 'status' => false, 'version' => $company->fresh()->version])->assertOk();
        foreach (['sub-companies' => $subCompany, 'associations' => $association, 'classifications' => $classification] as $entity => $record) {
            $this->getJson('/api/v1/'.$entity.'?id='.$record->id)->assertOk()->assertJsonCount(0, 'data');
        }
        $this->getJson('/api/v1/people?business_type_id='.$type->id)->assertOk()->assertJsonCount(0, 'data');
        $this->putJson('/api/v1/people/'.$person->id, ['name' => $person->name, 'status' => false, 'version' => $person->fresh()->version])->assertOk();
        $this->getJson('/api/v1/contacts?id='.$contact->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/people/'.$person->id.'/documents?context=management')->assertOk();
        $this->getJson('/api/v1/people/'.$person->id.'/employee?context=management')->assertOk()->assertJsonPath('eligible', false);
        $this->getJson('/api/v1/people/'.$person->id.'/documents')->assertNotFound();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('counts.people.total', 0)->assertJsonCount(0, 'recent_people')->assertJsonCount(0, 'companies');
    }

    public function test_management_visibility_preserves_company_permissions_and_soft_deletion(): void
    {
        $this->administrator();
        $allowed = Company::factory()->create(['status' => false]);
        $other = Company::factory()->create(['status' => false]);
        $operator = $this->operator(['companies.view', 'companies.update']);
        $operator->companies()->attach($allowed);
        $this->actingAs($operator);
        $this->getJson('/api/v1/companies?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/companies/'.$other->id.'?context=management')->assertOk();
        $this->getJson('/api/v1/companies')->assertOk()->assertJsonCount(0, 'data');
        $allowed->delete();
        $this->getJson('/api/v1/companies?context=management')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $other->id);
        $this->getJson('/api/v1/companies/'.$allowed->id.'?context=management')->assertNotFound();
    }

    public function test_disabled_users_and_roles_remain_in_administration_but_not_access_lookups(): void
    {
        $this->administrator();
        $role = Role::factory()->create(['name' => 'Disabled Custom Role', 'status' => false]);
        $activeRole = Role::factory()->create(['name' => 'Enabled Custom Role']);
        $disabledUser = User::factory()->create(['role_id' => $activeRole->id, 'status' => false]);
        $roleDisabledUser = User::factory()->create(['role_id' => $role->id]);
        $this->getJson('/api/v1/users?person_id=999999')->assertOk()->assertJsonCount(0, 'data');
        $lookupUsers = $this->getJson('/api/v1/users')->assertOk()->json('data');
        $this->assertNotContains($disabledUser->id, array_column($lookupUsers, 'id'));
        $this->assertNotContains($roleDisabledUser->id, array_column($lookupUsers, 'id'));
        $managementUsers = $this->getJson('/api/v1/users?context=management')->assertOk()->json('data');
        $this->assertContains($disabledUser->id, array_column($managementUsers, 'id'));
        $this->assertContains($roleDisabledUser->id, array_column($managementUsers, 'id'));
        $this->assertNotContains($role->id, array_column($this->getJson('/api/v1/roles')->assertOk()->json('data'), 'id'));
        $this->assertContains($role->id, array_column($this->getJson('/api/v1/roles?context=management')->assertOk()->json('data'), 'id'));
        $this->putJson('/api/v1/roles/'.$role->id, ['name' => $role->name, 'status' => true, 'permissions' => [], 'version' => $role->fresh()->version])->assertOk();
        $this->assertContains($role->id, array_column($this->getJson('/api/v1/roles')->assertOk()->json('data'), 'id'));
        $this->putJson('/api/v1/users/'.$disabledUser->id, ['name' => $disabledUser->name, 'username' => $disabledUser->username, 'role_id' => $activeRole->id, 'company_ids' => [], 'status' => true, 'version' => $disabledUser->fresh()->version])->assertOk();
        $this->assertContains($disabledUser->id, array_column($this->getJson('/api/v1/users')->assertOk()->json('data'), 'id'));
    }
}
