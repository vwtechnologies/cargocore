<?php

namespace Tests\Feature;

use App\Models\BusinessType;
use App\Models\City;
use App\Models\Company;
use App\Models\EmployeeType;
use App\Models\Person;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\Role;
use App\Models\User;
use Tests\ErpTestCase;

class PersonWorkspaceTest extends ErpTestCase
{
    public function test_empty_roles_do_not_create_an_association_and_selections_keep_company_specific_amounts(): void
    {
        $this->administrator();
        $person = Person::factory()->create()->refresh();
        $company = Company::factory()->create();
        $otherCompany = Company::factory()->create();
        $types = BusinessType::limit(2)->get();
        $url = "/api/v1/people/{$person->id}/company-roles/{$company->id}";
        $empty = ['version' => 0, 'classification_versions' => [], 'items' => []];
        $this->putJson($url, $empty)->assertOk()->assertJsonPath('data', null);
        $this->assertDatabaseCount('person_companies', 0);
        $input = $empty;
        $input['items'] = [['business_type_id' => $types[0]->id, 'opening_balance' => '123.45'], ['business_type_id' => $types[1]->id, 'opening_balance' => '-10.00']];
        $saved = $this->putJson($url, $input)->assertOk()->assertJsonPath('data.status', true)->assertJsonPath('classifications.0.opening_balance', '123.45')->json();
        $this->putJson("/api/v1/people/{$person->id}/company-roles/{$otherCompany->id}", $input)->assertOk();
        $this->putJson($url, ['version' => $saved['data']['version'], 'classification_versions' => $saved['classification_versions'], 'items' => []])->assertOk()->assertJsonPath('data.status', false)->assertJsonPath('classifications.0.status', false);
        $this->getJson("/api/v1/people?company_id={$company->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/v1/people?company_id={$otherCompany->id}")->assertOk()->assertJsonCount(1, 'data');
        $this->assertDatabaseCount('people', 1);
        $this->assertDatabaseCount('person_companies', 2);
        $this->assertDatabaseHas('person_classifications', ['opening_balance' => '123.45']);
    }

    public function test_stale_child_changes_and_invalid_batches_roll_back_the_entire_selection(): void
    {
        $this->administrator();
        $association = PersonCompany::factory()->create()->refresh();
        $role = PersonClassification::factory()->create(['person_company_id' => $association->id])->refresh();
        $url = "/api/v1/people/{$association->person_id}/company-roles/{$association->company_id}";
        $snapshot = $this->getJson($url)->assertOk()->json();
        $this->putJson("/api/v1/associations/{$association->id}/classifications/{$role->id}", ['business_type_id' => $role->business_type_id, 'opening_balance' => '99.50', 'status' => true, 'version' => $role->version])->assertOk();
        $input = ['version' => $snapshot['data']['version'], 'classification_versions' => $snapshot['classification_versions'], 'items' => []];
        $this->putJson($url, $input)->assertConflict();
        $this->assertDatabaseHas('person_classifications', ['id' => $role->id, 'opening_balance' => '99.50', 'status' => true]);
        $snapshot = $this->getJson($url)->assertOk()->json();
        $input['classification_versions'] = $snapshot['classification_versions'];
        $input['items'] = [['business_type_id' => $role->business_type_id, 'opening_balance' => '0.00'], ['business_type_id' => 999999, 'opening_balance' => '1.00']];
        $this->putJson($url, $input)->assertUnprocessable();
        $this->assertDatabaseHas('person_companies', ['id' => $association->id, 'version' => $association->version]);
        $this->assertDatabaseHas('person_classifications', ['id' => $role->id, 'opening_balance' => '99.50']);
    }

    public function test_reselecting_roles_restores_the_same_association_without_duplicate_people_or_assignments(): void
    {
        $this->administrator();
        $association = PersonCompany::factory()->create(['status' => false])->refresh();
        $role = PersonClassification::factory()->create(['person_company_id' => $association->id, 'status' => false])->refresh();
        $role->delete();
        $association->delete();
        $url = "/api/v1/people/{$association->person_id}/company-roles/{$association->company_id}";
        $snapshot = $this->getJson($url)->assertOk()->json();
        $this->putJson($url, ['version' => $association->version, 'classification_versions' => $snapshot['classification_versions'], 'items' => [['business_type_id' => $role->business_type_id, 'opening_balance' => '25.00']]])->assertOk()->assertJsonPath('data.id', $association->id)->assertJsonPath('classifications.0.id', $role->id)->assertJsonPath('classifications.0.status', true);
        $this->assertDatabaseCount('person_companies', 1);
        $this->assertDatabaseCount('person_classifications', 1);
    }

    public function test_company_role_endpoints_allow_unassigned_companies_and_enforce_module_permissions(): void
    {
        $this->administrator();
        $person = Person::factory()->create()->refresh();
        $company = Company::factory()->create();
        $operator = $this->operator(['people.view', 'companies.view', 'business-types.view', 'associations.view', 'associations.create', 'associations.update']);
        $url = "/api/v1/people/{$person->id}/company-roles/{$company->id}";
        $this->actingAs($operator)->getJson($url)->assertOk();
        $this->putJson($url, ['version' => 0, 'classification_versions' => [], 'items' => []])->assertOk()->assertJsonPath('data', null);
        $operator->companies()->attach($company);
        $this->getJson($url)->assertOk();
        $viewer = $this->operator(['people.view', 'companies.view', 'associations.view', 'business-types.view'], 'Viewer');
        $viewer->companies()->attach($company);
        $this->actingAs($viewer)->putJson($url, ['version' => 0, 'classification_versions' => [], 'items' => []])->assertForbidden();
    }

    public function test_person_place_is_an_active_city_reference_and_referenced_cities_cannot_be_deleted(): void
    {
        $this->administrator();
        $city = City::factory()->create();
        $person = $this->createRecord('people', ['name' => 'City linked person', 'city_id' => $city->id, 'status' => true]);
        $this->getJson('/api/v1/people/'.$person['id'])->assertOk()->assertJsonPath('data.city_id', $city->id)->assertJsonPath('data.city_name', $city->name);
        $this->deleteJson("/api/v1/countries/{$city->country_id}/cities/{$city->id}", ['version' => $city->version])->assertUnprocessable();
        $city->update(['status' => false]);
        $this->getJson('/api/v1/people/'.$person['id'].'?context=management')->assertOk()->assertJsonPath('data.city_name', null)->assertJsonPath('data.city_id', $city->id);
        $this->postJson('/api/v1/people', ['name' => 'Invalid city person', 'city_id' => $city->id])->assertUnprocessable();
    }

    public function test_employee_joining_date_and_multiple_types_are_saved_with_versions_in_one_transaction(): void
    {
        $this->administrator();
        $person = Person::factory()->create()->refresh();
        $association = PersonCompany::factory()->create(['person_id' => $person->id]);
        PersonClassification::factory()->create(['person_company_id' => $association->id, 'business_type_id' => BusinessType::where('is_employee', true)->firstOrFail()->id]);
        $ids = EmployeeType::limit(2)->pluck('id')->all();
        $url = "/api/v1/people/{$person->id}/employee";
        $input = ['version' => 0, 'joining_date' => '2026-01-15', 'person_version' => $person->version, 'type_ids' => $ids, 'salary' => '50000.00'];
        $saved = $this->putJson($url, $input)->assertOk()->assertJsonCount(2, 'data.types')->json('data');
        $this->assertDatabaseHas('people', ['id' => $person->id, 'joining_date' => '2026-01-15']);
        $input['version'] = $saved['version'];
        $input['salary'] = '90000.00';
        $this->putJson($url, $input)->assertConflict();
        $this->assertDatabaseHas('employee_profiles', ['person_id' => $person->id, 'salary' => '50000.00']);
    }

    public function test_linked_account_details_are_redacted_and_reject_unmanageable_administrators(): void
    {
        $super = $this->administrator();
        $person = Person::factory()->create();
        $super->update(['person_id' => $person->id]);
        $url = "/api/v1/people/{$person->id}/user-account";
        $this->getJson($url)->assertOk()->assertJsonPath('data.id', $super->id)->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.two_factor_secret');
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $this->actingAs($admin)->getJson($url)->assertNotFound();
        $operator = $this->operator(['people.view'], 'Profile reader');
        $this->actingAs($operator)->getJson($url)->assertForbidden();
    }

    public function test_existing_place_names_link_only_to_unambiguous_cities_without_losing_the_original_text(): void
    {
        $this->administrator();
        $city = City::factory()->create(['name' => 'Unique Existing Place']);
        $person = Person::factory()->create(['place' => $city->name])->refresh();
        City::factory()->count(2)->create(['name' => 'Ambiguous Existing Place']);
        $ambiguous = Person::factory()->create(['place' => 'Ambiguous Existing Place']);
        $migration = require database_path('migrations/2026_11_05_200622_link_existing_person_places_to_cities.php');
        $migration->up();
        $this->assertSame($city->id, $person->fresh()->city_id);
        $this->assertSame($city->name, $person->fresh()->place);
        $this->assertSame($person->version + 1, $person->fresh()->version);
        $this->assertNull($ambiguous->fresh()->city_id);
        $this->assertSame('Ambiguous Existing Place', $ambiguous->fresh()->place);
    }
}
