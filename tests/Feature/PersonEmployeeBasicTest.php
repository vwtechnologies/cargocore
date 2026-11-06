<?php

namespace Tests\Feature;

use App\Models\EmployeeProfile;
use App\Models\EmployeeType;
use App\Models\Person;
use Tests\ErpTestCase;

class PersonEmployeeBasicTest extends ErpTestCase
{
    public function test_basic_details_mark_the_current_person_as_an_employee_and_save_multiple_types_without_a_company_association(): void
    {
        $this->administrator();
        $types = EmployeeType::limit(2)->pluck('id')->all();
        $person = $this->createRecord('people', ['name' => 'Basic employee', 'is_employee' => true, 'employee' => ['type_ids' => $types, 'version' => 0]]);
        $this->assertTrue($person['is_employee']);
        $this->getJson("/api/v1/people/{$person['id']}/employee")->assertOk()->assertJsonPath('eligible', true)->assertJsonCount(2, 'data.types');
        $this->assertDatabaseCount('people', 1);
        $this->assertDatabaseCount('person_companies', 0);
        $this->assertDatabaseCount('employee_profile_type', 2);
        $this->assertDatabaseHas('audit_events', ['entity' => 'employee-details', 'action' => 'create']);
        $profile = EmployeeProfile::where('person_id', $person['id'])->firstOrFail();
        $profile->update(['salary' => '125000.25']);
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => $person['name'], 'is_employee' => true, 'version' => $person['version'], 'employee' => ['type_ids' => [], 'version' => $profile->version]])->assertOk();
        $this->assertSame('125000.25', $profile->refresh()->salary);
        $this->assertCount(0, $profile->types);
    }

    public function test_invalid_inactive_or_duplicate_types_and_stale_employee_versions_roll_back_person_changes(): void
    {
        $this->administrator();
        $types = EmployeeType::limit(2)->get();
        $types[1]->update(['status' => false]);
        foreach ([[$types[1]->id], [$types[0]->id, $types[0]->id], [999999]] as $ids) {
            $this->postJson('/api/v1/people', ['name' => 'Invalid employee', 'is_employee' => true, 'employee' => ['type_ids' => $ids, 'version' => 0]])->assertUnprocessable()->assertJsonValidationErrors('employee.type_ids.0');
        }
        $this->assertDatabaseCount('people', 0);
        $person = $this->createRecord('people', ['name' => 'Original employee', 'is_employee' => true, 'employee' => ['type_ids' => [$types[0]->id], 'version' => 0]]);
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => 'Unsaved identity', 'is_employee' => true, 'version' => $person['version'], 'employee' => ['type_ids' => [], 'version' => 0]])->assertConflict();
        $this->assertDatabaseHas('people', ['id' => $person['id'], 'name' => 'ORIGINAL EMPLOYEE', 'version' => $person['version']]);
        $this->assertDatabaseCount('employee_profile_type', 1);
        $this->postJson('/api/v1/people', ['name' => 'Not marked', 'employee' => ['type_ids' => [$types[0]->id], 'version' => 0]])->assertUnprocessable()->assertJsonValidationErrors('employee.type_ids');
        $this->postJson('/api/v1/people', ['name' => 'Inactive person', 'status' => false, 'is_employee' => true, 'employee' => ['type_ids' => [$types[0]->id], 'version' => 0]])->assertUnprocessable()->assertJsonValidationErrors('employee.type_ids');
        $this->assertDatabaseCount('people', 1);
    }

    public function test_unchecking_employee_retains_types_and_salary_and_inactive_types_are_hidden_but_preserved(): void
    {
        $this->administrator();
        $types = EmployeeType::limit(2)->get();
        $person = $this->createRecord('people', ['name' => 'Historical employee', 'is_employee' => true, 'employee' => ['type_ids' => $types->pluck('id')->all(), 'version' => 0]]);
        $profile = EmployeeProfile::where('person_id', $person['id'])->firstOrFail();
        $profile->update(['salary' => '70000.00']);
        $types[0]->update(['status' => false]);
        $this->putJson("/api/v1/people/{$person['id']}/employee", ['type_ids' => [$types[1]->id], 'salary' => '70000.00', 'version' => $profile->version])->assertOk()->assertJsonCount(1, 'data.types');
        $profile->refresh();
        $this->assertDatabaseCount('employee_profile_type', 2);
        $this->getJson('/api/v1/employee-types?context=lookup')->assertOk()->assertJsonMissing(['id' => $types[0]->id]);
        $this->getJson("/api/v1/people/{$person['id']}/employee")->assertOk()->assertJsonCount(1, 'data.types');
        $person = $this->putJson("/api/v1/people/{$person['id']}", ['name' => $person['name'], 'is_employee' => true, 'version' => $person['version'], 'employee' => ['type_ids' => [], 'version' => $profile->version]])->assertOk()->json('data');
        $this->assertSame([$types[0]->id], $profile->refresh()->types()->pluck('employee_types.id')->all());
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => $person['name'], 'is_employee' => false, 'version' => $person['version']])->assertOk()->assertJsonPath('data.is_employee', false);
        $this->getJson("/api/v1/people/{$person['id']}/employee")->assertOk()->assertJsonPath('eligible', false)->assertJsonPath('data.salary', '70000.00');
        $this->assertDatabaseCount('employee_profiles', 1);
        $this->assertDatabaseCount('employee_profile_type', 1);
    }

    public function test_employee_changes_require_dedicated_permissions_and_person_editors_cannot_forge_them(): void
    {
        $this->administrator();
        $type = EmployeeType::firstOrFail();
        $person = $this->createRecord('people', ['name' => 'Protected person']);
        $editor = $this->operator(['people.view', 'people.create', 'people.update']);
        $this->actingAs($editor);
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => 'Forbidden edit', 'is_employee' => true, 'version' => $person['version']])->assertForbidden();
        $this->postJson('/api/v1/people', ['name' => 'Forbidden employee', 'is_employee' => true, 'employee' => ['type_ids' => [$type->id], 'version' => 0]])->assertForbidden();
        $this->assertDatabaseCount('employee_profiles', 0);
        $this->assertDatabaseCount('people', 1);
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => 'Ordinary update', 'version' => $person['version']])->assertOk();
        $this->assertDatabaseHas('people', ['id' => $person['id'], 'name' => 'ORDINARY UPDATE', 'is_employee' => false]);
    }

    public function test_creating_employee_details_does_not_grant_permission_to_update_an_existing_profile(): void
    {
        $this->administrator();
        $type = EmployeeType::firstOrFail();
        $creator = $this->operator(['people.view', 'people.create', 'people.update', 'employee-details.view', 'employee-details.create']);
        $this->actingAs($creator);
        $person = $this->createRecord('people', ['name' => 'Create only employee', 'is_employee' => true, 'employee' => ['type_ids' => [$type->id], 'version' => 0]]);
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => 'Forbidden update', 'is_employee' => false, 'version' => $person['version']])->assertForbidden();
        $this->putJson("/api/v1/people/{$person['id']}", ['name' => 'Forbidden update', 'is_employee' => true, 'version' => $person['version'], 'employee' => ['type_ids' => [], 'version' => 1]])->assertForbidden();
        $this->assertTrue(Person::findOrFail($person['id'])->is_employee);
        $this->assertDatabaseCount('employee_profile_type', 1);
    }
}
