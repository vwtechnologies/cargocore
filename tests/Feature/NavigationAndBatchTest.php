<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Person;
use App\Models\PersonCompany;
use Tests\ErpTestCase;

class NavigationAndBatchTest extends ErpTestCase
{
    public function test_navigation_uses_filtered_order_across_pages_without_exposing_other_records(): void
    {
        $this->administrator();
        $first = Person::factory()->create(['name' => 'Nav Alpha']);
        $middle = Person::factory()->create(['name' => 'Nav Beta']);
        $last = Person::factory()->create(['name' => 'Nav Gamma']);
        Person::factory()->create(['name' => 'Nav Disabled', 'status' => false]);
        $outside = Person::factory()->create(['name' => 'Outside']);
        $query = '/api/v1/people?search=Nav&status=1&sort=name&direction=desc&per_page=1&position_of=';
        $this->getJson($query.$middle->id)->assertOk()->assertJsonPath('navigation.first', $last->id)->assertJsonPath('navigation.previous', $last->id)->assertJsonPath('navigation.next', $first->id)->assertJsonPath('navigation.last', $first->id)->assertJsonPath('navigation.position', 2)->assertJsonPath('navigation.total', 3);
        $this->getJson($query.$outside->id)->assertNotFound();
        $this->getJson($query.$last->id)->assertOk()->assertJsonPath('navigation.previous', null);
        $operator = $this->operator(['companies.view']);
        $a = Company::factory()->create();
        $b = Company::factory()->create();
        $operator->companies()->attach($a);
        $this->actingAs($operator)->getJson('/api/v1/companies?position_of='.$b->id)->assertOk();
        $this->getJson('/api/v1/companies?position_of='.$a->id)->assertOk()->assertJsonPath('navigation.total', 2);
    }

    public function test_multiple_classifications_are_atomic_and_keep_individual_opening_amounts(): void
    {
        $this->administrator();
        $association = PersonCompany::factory()->create();
        $types = BusinessType::limit(2)->get();
        $url = '/api/v1/associations/'.$association->id.'/classifications/batch';
        $this->postJson($url, ['items' => [['business_type_id' => $types[0]->id, 'opening_balance' => '12.50'], ['business_type_id' => $types[0]->id, 'opening_balance' => '15.00']]])->assertUnprocessable();
        $this->assertDatabaseCount('person_classifications', 0);
        $this->postJson($url, ['items' => [['business_type_id' => $types[0]->id, 'opening_balance' => '12.50'], ['business_type_id' => $types[1]->id, 'opening_balance' => '-15.00']]])->assertCreated()->assertJsonPath('data.0.opening_balance', '12.50')->assertJsonPath('data.1.opening_balance', '-15.00');
        $this->assertDatabaseCount('person_classifications', 2);
    }

    public function test_audit_access_hides_other_company_and_account_administration_events(): void
    {
        $admin = $this->administrator();
        $operator = $this->operator(['audit.view']);
        $company = Company::factory()->create();
        AuditEvent::create(['action' => 'update', 'entity' => 'users', 'record_id' => $admin->id, 'changes' => []]);
        AuditEvent::create(['action' => 'update', 'entity' => 'companies', 'record_id' => $company->id, 'company_id' => $company->id, 'changes' => []]);
        $this->actingAs($operator)->getJson('/api/v1/audit')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.entity', 'companies');
    }

    public function test_child_search_and_sort_use_related_display_names(): void
    {
        $this->administrator();
        $person = Person::factory()->create();
        $z = Company::factory()->create(['name' => 'Zebra']);
        $a = Company::factory()->create(['name' => 'Alpha']);
        PersonCompany::factory()->create(['person_id' => $person->id, 'company_id' => $z->id]);
        $first = PersonCompany::factory()->create(['person_id' => $person->id, 'company_id' => $a->id]);
        $this->getJson('/api/v1/people/'.$person->id.'/associations?sort=company_name')->assertOk()->assertJsonPath('data.0.id', $first->id);
        $this->getJson('/api/v1/people/'.$person->id.'/associations?search=Alpha')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/people/'.$person->id.'/associations?search=Missing')->assertOk()->assertJsonCount(0, 'data');
    }
}
