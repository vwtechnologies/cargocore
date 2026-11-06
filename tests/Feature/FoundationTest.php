<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Country;
use App\Models\EmployeeProfile;
use App\Models\EmployeeType;
use App\Models\Person;
use Tests\ErpTestCase;

class FoundationTest extends ErpTestCase
{
    public function test_company_defaults_children_and_optimistic_concurrency(): void
    {
        $this->administrator();
        $first = $this->createRecord('companies', ['name' => 'North Trading', 'status' => true]);
        $this->assertTrue($first['is_default']);
        $child = $this->createRecord('companies/'.$first['id'].'/sub-companies', ['name' => 'North Warehouse', 'status' => true, 'is_default' => true, 'contact_numbers' => ['051-5551000', '051-5551001'], 'mobile_numbers' => ['0300-1111111']]);
        $second = $this->createRecord('companies', ['name' => 'South Trading', 'status' => true, 'is_default' => true]);
        $this->assertDatabaseHas('companies', ['id' => $first['id'], 'is_default' => false, 'version' => 2]);
        $this->putJson('/api/v1/companies/'.$first['id'], ['name' => 'Stale', 'version' => 1])->assertConflict();
        $this->putJson('/api/v1/companies/'.$second['id'], ['name' => 'South Trading', 'status' => false, 'version' => 1])->assertUnprocessable()->assertJsonValidationErrors('is_default');
        $this->getJson('/api/v1/companies/'.$first['id'].'/sub-companies')->assertOk()->assertJsonPath('data.0.contact_numbers.1', '051-5551001');
        $this->getJson('/api/v1/companies/'.$second['id'].'/sub-companies/'.$child['id'])->assertNotFound();
        $this->deleteJson('/api/v1/companies/'.$first['id'], ['version' => 2])->assertUnprocessable()->assertJsonValidationErrors('record');
        $this->assertDatabaseHas('audit_events', ['entity' => 'companies', 'action' => 'create', 'record_id' => $first['id']]);
    }

    public function test_all_simple_masters_support_create_search_update_and_soft_delete(): void
    {
        $this->administrator();
        foreach (['countries' => ['name' => 'Test Republic', 'short_name' => 'TR', 'display_sequence' => 4], 'banks' => ['name' => 'Test Bank', 'short_name' => 'TB', 'uan' => '123', 'help_line' => '456', 'e_bank' => 'Online Banking', 'website' => 'https://example.test'], 'employee-types' => ['name' => 'Port Supervisor'], 'business-types' => ['name' => 'Freight Partner'], 'markas' => ['code' => 'MK-TEST', 'description' => 'Test export marking']] as $entity => $fields) {
            $record = $this->createRecord($entity, $fields + ['status' => true]);
            $this->getJson('/api/v1/'.$entity.'?search='.urlencode((string) ($fields['name'] ?? 'MK-TEST')).'&sort=id;DROP TABLE users')->assertOk()->assertJsonPath('meta.total', 1);
            $this->putJson('/api/v1/'.$entity.'/'.$record['id'], $fields + ['status' => false, 'version' => 1])->assertOk()->assertJsonPath('data.version', 2)->assertJsonPath('data.status', false);
            $this->deleteJson('/api/v1/'.$entity.'/'.$record['id'], ['version' => 2])->assertNoContent();
            $this->getJson('/api/v1/'.$entity.'/'.$record['id'])->assertNotFound();
        }
    }

    public function test_employee_types_generate_internal_codes_and_only_accept_name_and_status(): void
    {
        $this->administrator();
        $nextTypeNumber = (int) EmployeeType::max('type_number') + 1;
        $first = $this->createRecord('employee-types', ['name' => 'Dispatch Supervisor', 'status' => true, 'code' => 'MANUAL', 'type_number' => 999, 'description' => 'Not an editable field']);
        $second = $this->createRecord('employee-types', ['name' => 'Warehouse Supervisor', 'status' => true]);
        $this->assertMatchesRegularExpression('/^EMP-[0-9]{6}$/', $first['code']);
        $this->assertNotSame($first['code'], $second['code']);
        $this->assertSame($nextTypeNumber, $first['type_number']);
        $this->assertSame($nextTypeNumber + 1, $second['type_number']);
        $this->assertNull($first['description']);

        $existing = EmployeeType::factory()->create(['code' => 'LEGACY-TYPE', 'description' => 'Retained legacy description']);
        $this->putJson('/api/v1/employee-types/'.$existing->id, ['name' => 'Updated employee type', 'status' => false, 'version' => 1, 'code' => 'REPLACED', 'description' => null, 'type_number' => 999])
            ->assertOk()->assertJsonPath('data.name', 'UPDATED EMPLOYEE TYPE')->assertJsonPath('data.status', false)
            ->assertJsonPath('data.code', 'LEGACY-TYPE')->assertJsonPath('data.description', 'Retained legacy description')->assertJsonPath('data.type_number', $existing->type_number);
        $this->getJson('/api/v1/employee-types/'.$existing->id)->assertNotFound();
        $this->getJson('/api/v1/employee-types/'.$existing->id.'?context=management')->assertOk();
    }

    public function test_geography_generates_codes_keeps_optional_city_names_and_uses_country_display_order(): void
    {
        $this->administrator();
        $later = $this->createRecord('countries', ['name' => 'Later Country', 'short_name' => 'LC', 'display_sequence' => 20, 'status' => true]);
        $first = $this->createRecord('countries', ['name' => 'First Country', 'short_name' => 'FC', 'display_sequence' => 10, 'status' => true]);
        $this->assertStringStartsWith('CTY-', $first['code']);
        $this->getJson('/api/v1/countries')->assertOk()->assertJsonPath('data.0.id', $first['id'])->assertJsonPath('data.1.id', $later['id']);
        $this->getJson('/api/v1/countries?sort=name&direction=desc')->assertOk()->assertJsonPath('data.0.id', $later['id']);
        $this->putJson('/api/v1/countries/'.$later['id'], ['name' => 'Later Country', 'short_name' => 'LC', 'display_sequence' => 5, 'status' => false, 'version' => $later['version']])->assertOk()->assertJsonPath('data.display_sequence', 5)->assertJsonPath('data.status', false);
        $this->getJson('/api/v1/countries')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first['id']);
        $this->getJson('/api/v1/countries?status=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first['id']);
        $city = $this->createRecord('countries/'.$first['id'].'/cities', ['name' => 'Linked City', 'short_name_1' => null, 'short_name_2' => null, 'status' => false]);
        $this->assertStringStartsWith('CIT-', $city['code']);
        $this->assertDatabaseHas('cities', ['id' => $city['id'], 'country_id' => $first['id'], 'short_name_1' => null, 'short_name_2' => null, 'status' => false]);
        $this->putJson('/api/v1/countries/'.$first['id'].'/cities/'.$city['id'], ['code' => $city['code'], 'name' => 'Linked City', 'short_name_1' => 'LC', 'short_name_2' => 'LCT', 'status' => true, 'version' => $city['version']])->assertOk()->assertJsonPath('data.short_name_1', 'LC')->assertJsonPath('data.short_name_2', 'LCT')->assertJsonPath('data.code', $city['code']);
        $this->getJson('/api/v1/countries/'.$later['id'].'/cities')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/countries', ['name' => 'Invalid Order', 'display_sequence' => -1])->assertUnprocessable()->assertJsonValidationErrors('display_sequence');
    }

    public function test_city_and_bank_chain_reject_mismatches_and_preserve_account_strings(): void
    {
        $this->administrator();
        $country = Country::factory()->create();
        $other = Country::factory()->create();
        $city = $this->createRecord('countries/'.$country->id.'/cities', ['name' => 'Port City', 'code' => 'PORT01', 'short_name_1' => 'PC', 'short_name_2' => 'PORT', 'status' => true]);
        $bank = Bank::factory()->create();
        $person = Person::factory()->create();
        $branch = $this->createRecord('banks/'.$bank->id.'/branches', ['name' => 'Main', 'city_id' => $city['id'], 'country_id' => $country->id, 'branch_code' => '0007', 'nift_code' => '0017', 'phone_numbers' => ['555-1212']]);
        $account = ['bank_id' => $bank->id, 'country_id' => $country->id, 'city_id' => $city['id'], 'bank_branch_id' => $branch['id'], 'account_number' => '0000012007', 'account_title' => 'Port Customer', 'status' => true];
        $this->postJson('/api/v1/people/'.$person->id.'/accounts', array_replace($account, ['country_id' => $other->id]))->assertUnprocessable()->assertJsonValidationErrors('bank_branch_id');
        $this->postJson('/api/v1/people/'.$person->id.'/accounts', $account + ['iban' => 'PK00INVALID00000000000000'])->assertUnprocessable()->assertJsonValidationErrors('iban');
        $saved = $this->createRecord('people/'.$person->id.'/accounts', $account);
        $this->assertSame('0000012007', $saved['account_number']);
        $this->assertSame($country->id, $saved['country_id']);
        $this->deleteJson('/api/v1/banks/'.$bank->id.'/branches/'.$branch['id'], ['version' => 1])->assertUnprocessable();
        $this->getJson('/api/v1/cities?country_id='.$other->id)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_person_is_shared_with_company_specific_balances_and_one_salary(): void
    {
        $this->administrator();
        $a = Company::factory()->create();
        $b = Company::factory()->create();
        $person = $this->createRecord('people', ['name' => 'Test Person', 'father_husband_name' => 'Parent', 'cnic' => '12345-1234567-1', 'date_of_birth' => '1990-01-01', 'gender' => 'Other', 'joining_date' => '2020-01-01', 'place' => 'Rawalpindi', 'ntn' => '000123', 'strn' => '000456']);
        $this->assertSame('1234512345671', $person['cnic']);
        $this->postJson('/api/v1/people', ['name' => 'Duplicate CNIC', 'cnic' => '1234512345671'])->assertUnprocessable()->assertJsonValidationErrors('cnic');
        $contact = $this->createRecord('people/'.$person['id'].'/contacts', ['label' => 'Home', 'address' => 'Test road', 'phone' => '00123', 'mobile' => '00456', 'email' => 'person@example.test']);
        $aa = $this->createRecord('people/'.$person['id'].'/associations', ['company_id' => $a->id]);
        $ab = $this->createRecord('people/'.$person['id'].'/associations', ['company_id' => $b->id]);
        $employee = BusinessType::where('is_employee', true)->firstOrFail();
        $customer = BusinessType::where('name', 'Customer')->firstOrFail();
        $c = $this->createRecord('associations/'.$aa['id'].'/classifications', ['business_type_id' => $employee->id, 'opening_balance' => '100.50']);
        $this->createRecord('associations/'.$aa['id'].'/classifications', ['business_type_id' => $customer->id, 'opening_balance' => '250.75']);
        $this->createRecord('associations/'.$ab['id'].'/classifications', ['business_type_id' => $customer->id, 'opening_balance' => '-75.25']);
        $this->postJson('/api/v1/people/'.$person['id'].'/associations', ['company_id' => $a->id])->assertUnprocessable()->assertJsonValidationErrors('company_id');
        $this->postJson('/api/v1/associations/'.$aa['id'].'/classifications', ['business_type_id' => $employee->id])->assertUnprocessable()->assertJsonValidationErrors('business_type_id');
        $this->putJson('/api/v1/people/'.$person['id'].'/employee', ['salary' => '125000.25', 'type_ids' => EmployeeType::limit(2)->pluck('id')->all(), 'version' => 0])->assertOk()->assertJsonPath('data.salary', '125000.25');
        $this->assertSame(1, EmployeeProfile::where('person_id', $person['id'])->count());
        $this->getJson('/api/v1/people?company_id='.$b->id.'&business_type_id='.$customer->id)->assertOk()->assertJsonPath('data.0.id', $person['id']);
        $this->putJson('/api/v1/associations/'.$aa['id'].'/classifications/'.$c['id'], ['business_type_id' => $employee->id, 'opening_balance' => '100.50', 'status' => false, 'version' => 1])->assertOk();
        $this->getJson('/api/v1/people/'.$person['id'].'/employee')->assertOk()->assertJsonPath('eligible', false)->assertJsonPath('data.salary', '125000.25');
        $this->assertStringNotContainsString('1234512345671', AuditEvent::where('entity', 'people')->firstOrFail()->getRawOriginal('changes'));
    }

    public function test_officers_reuse_people_and_reject_branches_of_other_banks(): void
    {
        $this->administrator();
        $bank = Bank::factory()->create();
        $person = Person::factory()->create();
        $otherBranch = BankBranch::factory()->create();
        $this->postJson('/api/v1/banks/'.$bank->id.'/officers', ['person_id' => $person->id, 'designation' => 'Manager', 'bank_branch_id' => $otherBranch->id])->assertUnprocessable()->assertJsonValidationErrors('bank_branch_id');
        $officer = $this->createRecord('banks/'.$bank->id.'/officers', ['person_id' => $person->id, 'designation' => 'Manager', 'contact_number' => '0001', 'email' => 'officer@example.test']);
        $this->assertSame($person->name, $officer['person_name']);
        $this->assertDatabaseCount('people', 1);
        $this->assertDatabaseCount('employee_profiles', 0);
    }
}
