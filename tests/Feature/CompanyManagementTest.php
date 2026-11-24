<?php

namespace Tests\Feature;

use App\Models\BankBranch;
use App\Models\City;
use App\Models\Company;
use App\Models\CompanyAddress;
use App\Models\CompanyContact;
use App\Models\Country;
use App\Models\Person;
use Tests\ErpTestCase;

class CompanyManagementTest extends ErpTestCase
{
    public function test_details_and_tax_fields_persist_without_affecting_portal_access_or_business_roles(): void
    {
        $admin = $this->administrator();
        $loginCompany = Company::factory()->create();
        $admin->companies()->attach($loginCompany);
        $parent = Company::factory()->create();
        $company = $this->createRecord('companies', ['name' => 'Legal company', 'short_name' => 'LC', 'type' => 'Private limited', 'parent_company_id' => $parent->id, 'ntn' => 'ntn-12', 'strn' => 'strn-34', 'weboc_id' => 'weboc-56', 'psw_id' => 'psw-78']);
        $this->assertSame('LEGAL COMPANY', $company['name']);
        $this->assertSame('WEBOC-56', $company['weboc_id']);
        $this->assertSame($parent->id, $company['parent_company_id']);
        $this->assertSame([$loginCompany->id], $admin->companies()->pluck('companies.id')->all());
        $this->assertDatabaseCount('person_companies', 0);
        $this->assertDatabaseCount('person_classifications', 0);
        $this->postJson('/api/v1/companies', ['name' => 'Unsafe', 'weboc_password' => 'do-not-store'])->assertUnprocessable()->assertJsonValidationErrors('weboc_password');
        $this->assertDatabaseMissing('companies', ['name' => 'UNSAFE']);
    }

    public function test_parent_company_cannot_reference_itself_or_form_a_cycle(): void
    {
        $this->administrator();
        $parent = Company::factory()->create();
        $child = Company::factory()->create(['parent_company_id' => $parent->id]);
        foreach ([$parent->id, $child->id] as $id) {
            $this->putJson("/api/v1/companies/{$parent->id}", ['name' => $parent->name, 'parent_company_id' => $id, 'version' => 1])->assertUnprocessable()->assertJsonValidationErrors('parent_company_id');
        }
        $this->assertNull($parent->refresh()->parent_company_id);
    }

    public function test_repeatable_details_have_one_primary_per_company_and_preserve_version_conflicts(): void
    {
        $this->administrator();
        $company = Company::factory()->create();
        $other = Company::factory()->create();
        foreach (['company-contacts' => ['number' => '+92 300 1234567'], 'company-emails' => ['email' => 'demo@example.test'], 'company-addresses' => ['address_line_1' => 'Registered office', 'country_id' => Country::factory()->create()->id]] as $entity => $fields) {
            $url = "/api/v1/companies/{$company->id}/$entity";
            $first = $this->postJson($url, ['title' => 'Registered', 'is_primary' => true] + $fields)->assertCreated()->json('data');
            $second = $this->postJson($url, ['title' => 'Local', 'is_primary' => true] + $fields)->assertCreated()->json('data');
            $this->getJson("$url/{$first['id']}?context=management")->assertOk()->assertJsonPath('data.is_primary', false)->assertJsonPath('data.version', 2)->assertJsonMissingPath('data.primary_guard');
            $this->putJson("$url/{$first['id']}", ['title' => 'Old draft', 'version' => $first['version']] + $fields)->assertConflict();
            $this->getJson("$url?search=local&context=management")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second['id']);
            $this->getJson("/api/v1/companies/{$other->id}/$entity?context=management")->assertOk()->assertJsonCount(0, 'data');
            $this->postJson($url, ['title' => 'Invalid', 'status' => false, 'is_primary' => true] + $fields)->assertUnprocessable();
            $this->deleteJson("$url/{$second['id']}", ['version' => $second['version']])->assertNoContent();
        }
    }

    public function test_addresses_validate_geography_and_lookups_filter_by_company(): void
    {
        $this->administrator();
        $company = Company::factory()->create();
        $country = Country::factory()->create();
        $city = City::factory()->create();
        $url = "/api/v1/companies/{$company->id}/company-addresses";
        $this->postJson($url, ['title' => 'Local', 'address_line_1' => 'Office', 'country_id' => $country->id, 'city_id' => $city->id])->assertUnprocessable()->assertJsonValidationErrors('city_id');
        $saved = $this->postJson($url, ['title' => 'Bank letters', 'address_line_1' => 'Local office', 'country_id' => $city->country_id, 'city_id' => $city->id])->assertCreated()->json('data');
        $this->putJson("$url/{$saved['id']}", ['title' => 'Bank letters', 'address_line_1' => 'Local office', 'country_id' => $country->id, 'version' => $saved['version']])->assertUnprocessable()->assertJsonValidationErrors('city_id');
        CompanyAddress::factory()->create();
        $this->getJson("/api/v1/company-addresses?context=lookup&company_id={$company->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $saved['id'])->assertJsonPath('data.0.name', 'BANK LETTERS — LOCAL OFFICE');
    }

    public function test_owners_fill_identity_from_people_and_validate_percentage_totals(): void
    {
        $this->administrator();
        $company = Company::factory()->create();
        $person = Person::factory()->create(['name' => 'LINKED OWNER', 'cnic' => '1234512345671']);
        $url = "/api/v1/companies/{$company->id}/company-owners";
        $owner = $this->postJson($url, ['person_id' => $person->id, 'name' => 'Ignored', 'cnic' => '9999999999999', 'designation' => 'Director', 'ownership_percentage' => '60.50'])->assertCreated()->json('data');
        $this->assertSame($person->name, $owner['name']);
        $this->assertSame($person->cnic, $owner['cnic']);
        $this->assertSame('DIRECTOR', $owner['designation']);
        $this->postJson($url, ['person_id' => $person->id])->assertUnprocessable()->assertJsonValidationErrors('person_id');
        foreach (['-1', '101', '39.51'] as $percent) {
            $this->postJson($url, ['name' => 'Another owner', 'ownership_percentage' => $percent])->assertUnprocessable()->assertJsonValidationErrors('ownership_percentage');
        }
        $this->postJson($url, ['name' => 'Other owner', 'ownership_percentage' => '39.50'])->assertCreated();
        $this->postJson($url, ['name' => 'Representative', 'designation' => 'Manager'])->assertCreated();
        $inactive = $this->postJson($url, ['name' => 'Former owner', 'ownership_percentage' => '25.00', 'status' => false])->assertCreated()->json('data');
        $this->patchJson("$url/{$inactive['id']}", ['status' => true, 'version' => $inactive['version']])->assertUnprocessable()->assertJsonValidationErrors('ownership_percentage');
        $this->assertDatabaseCount('person_classifications', 0);
    }

    public function test_bank_accounts_keep_legal_holder_separate_from_login_and_person_classifications(): void
    {
        $admin = $this->administrator();
        $workspace = Company::factory()->create();
        $admin->companies()->attach($workspace);
        $address = CompanyAddress::factory()->create();
        $other = CompanyAddress::factory()->create();
        $person = Person::factory()->create();
        $branch = BankBranch::factory()->create();
        $fields = ['account_title' => 'Legal account', 'account_number' => '001Il123', 'country_id' => $branch->city->country_id, 'city_id' => $branch->city_id, 'bank_id' => $branch->bank_id, 'bank_branch_id' => $branch->id, 'company_id' => $address->company_id, 'company_address_id' => $address->id];
        $url = "/api/v1/people/{$person->id}/accounts";
        $account = $this->postJson($url, $fields)->assertCreated()->json('data');
        $this->assertSame($address->company_id, $account['company_id']);
        $this->assertSame($address->title, $account['company_address_title']);
        $partial = array_replace($fields, ['company_id' => $other->company_id, 'version' => $account['version']]);
        unset($partial['company_address_id']);
        $this->patchJson("$url/{$account['id']}", $partial)->assertUnprocessable()->assertJsonValidationErrors('company_address_id');
        $this->postJson($url, array_replace($fields, ['company_address_id' => $other->id]))->assertUnprocessable()->assertJsonValidationErrors('company_address_id');
        $this->postJson($url, array_replace($fields, ['company_id' => null]))->assertUnprocessable()->assertJsonValidationErrors('company_address_id');
        $this->assertSame([$workspace->id], $admin->companies()->pluck('companies.id')->all());
        $this->assertDatabaseCount('person_classifications', 0);
        $this->deleteJson("/api/v1/companies/{$address->company_id}/company-addresses/{$address->id}", ['version' => $address->version])->assertUnprocessable();
    }

    public function test_company_detail_permissions_and_inactive_parents_are_enforced(): void
    {
        $this->administrator();
        $company = Company::factory()->create();
        $contact = CompanyContact::factory()->create(['company_id' => $company->id]);
        $viewer = $this->operator(['companies.view']);
        $this->actingAs($viewer);
        $url = "/api/v1/companies/{$company->id}/company-contacts";
        $this->getJson("$url?context=management")->assertOk();
        $this->postJson($url, ['title' => 'Office', 'number' => '123'])->assertForbidden();
        $this->putJson("$url/{$contact->id}", ['title' => 'Office', 'number' => '123', 'version' => $contact->version])->assertForbidden();
        $this->deleteJson("$url/{$contact->id}", ['version' => $contact->version])->assertForbidden();
        $writer = $this->operator(['companies.view', 'companies.create'], 'Company Writer');
        $this->actingAs($writer);
        $company->update(['status' => false]);
        $this->postJson($url, ['title' => 'Office', 'number' => '123'])->assertUnprocessable();
        $this->getJson("/api/v1/company-contacts?company_id={$company->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->operator(['people.view'], 'Person Viewer'));
        $this->getJson("$url?context=management")->assertForbidden();
    }
}
