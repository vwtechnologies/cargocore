<?php

namespace Tests\Feature;

use App\Models\Marka;
use App\Models\Person;
use App\Models\PersonMarka;
use App\Models\Role;
use App\Models\User;
use Tests\ErpTestCase;

class MarkaTest extends ErpTestCase
{
    public function test_manual_marka_codes_are_unique_and_versioned_and_inactive_masters_remain_manageable(): void
    {
        $this->administrator();
        $record = $this->createRecord('markas', ['code' => 'XYZ', 'description' => 'For girls cloth', 'status' => true]);
        $this->assertSame('XYZ', $record['code']);
        $this->postJson('/api/v1/markas', ['code' => 'XYZ', 'description' => 'Duplicate'])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->postJson('/api/v1/markas', ['code' => '', 'description' => ''])->assertUnprocessable()->assertJsonValidationErrors(['code', 'description']);
        $this->putJson('/api/v1/markas/'.$record['id'], ['code' => 'REPLACED', 'description' => 'Changed', 'version' => 1])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->putJson('/api/v1/markas/'.$record['id'], ['code' => 'XYZ', 'description' => 'Updated description', 'status' => false, 'version' => 1])->assertOk()->assertJsonPath('data.version', 2);
        $this->putJson('/api/v1/markas/'.$record['id'], ['code' => 'XYZ', 'description' => 'Stale', 'version' => 1])->assertConflict();
        $this->getJson('/api/v1/markas?context=lookup&search=XYZ')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/markas?context=management&search=Updated')->assertOk()->assertJsonPath('data.0.code', 'XYZ')->assertJsonPath('data.0.status', false);
        $this->assertDatabaseHas('audit_events', ['entity' => 'markas', 'action' => 'update', 'record_id' => $record['id']]);
    }

    public function test_people_can_share_multiple_markas_without_duplicates_or_broken_parent_links(): void
    {
        $this->administrator();
        $person = Person::factory()->create();
        $other = Person::factory()->create();
        $first = Marka::factory()->create(['code' => 'WYD', 'description' => 'For boys cloth']);
        $second = Marka::factory()->create(['code' => 'XYZ', 'description' => 'For girls cloth']);
        $path = 'people/'.$person->id.'/person-markas';
        $assignment = $this->createRecord($path, ['marka_id' => $first->id, 'status' => true]);
        $this->createRecord($path, ['marka_id' => $second->id]);
        $this->createRecord('people/'.$other->id.'/person-markas', ['marka_id' => $first->id]);
        $this->getJson('/api/v1/'.$path)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.marka_code', 'WYD')->assertJsonPath('data.0.marka_description', 'For boys cloth');
        $this->getJson('/api/v1/'.$path.'?search=girls')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.marka_id', $second->id);
        $this->getJson('/api/v1/'.$path.'?per_page=1&page=2&sort=marka_code')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/'.$path, ['marka_id' => $first->id])->assertUnprocessable()->assertJsonValidationErrors('marka_id');
        $this->getJson('/api/v1/people/'.$other->id.'/person-markas/'.$assignment['id'])->assertNotFound();
        $this->putJson('/api/v1/people/'.$other->id.'/person-markas/'.$assignment['id'], ['marka_id' => $second->id, 'version' => 1])->assertNotFound();
        $this->deleteJson('/api/v1/markas/'.$first->id, ['version' => 1])->assertUnprocessable()->assertJsonValidationErrors('record');
        $this->deleteJson('/api/v1/people/'.$person->id, ['version' => 1])->assertUnprocessable()->assertJsonValidationErrors('record');
        $this->putJson('/api/v1/'.$path.'/'.$assignment['id'], ['marka_id' => $first->id, 'status' => false, 'version' => 1])->assertOk()->assertJsonPath('data.version', 2);
        $this->putJson('/api/v1/'.$path.'/'.$assignment['id'], ['marka_id' => $first->id, 'status' => true, 'version' => 1])->assertConflict();
        $this->getJson('/api/v1/'.$path)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/'.$path.'?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->deleteJson('/api/v1/'.$path.'/'.$assignment['id'], ['version' => 2])->assertNoContent();
        $this->createRecord($path, ['marka_id' => $first->id]);
        $first->update(['status' => false]);
        $this->getJson('/api/v1/'.$path)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/'.$path.'?context=management')->assertOk()->assertJsonCount(2, 'data');
        $third = Person::factory()->create();
        $this->postJson('/api/v1/people/'.$third->id.'/person-markas', ['marka_id' => $first->id])->assertUnprocessable()->assertJsonValidationErrors('marka_id');
        $this->assertSame(2, $person->markaAssignments()->count());
        $this->assertSame(2, $first->personAssignments()->count());
        $this->assertDatabaseHas('audit_events', ['entity' => 'person-markas', 'action' => 'delete', 'record_id' => $assignment['id']]);
    }

    public function test_marka_assignments_enforce_permissions_active_parents_and_private_person_scope(): void
    {
        $super = $this->administrator();
        $person = Person::factory()->create();
        $hidden = Person::factory()->create();
        $super->update(['person_id' => $hidden->id]);
        $marka = Marka::factory()->create();
        $private = PersonMarka::factory()->create(['person_id' => $hidden->id, 'marka_id' => $marka->id]);
        $assignment = PersonMarka::factory()->create(['person_id' => $person->id, 'marka_id' => $marka->id]);
        $viewer = $this->operator(['people.view', 'markas.view']);
        $this->actingAs($viewer);
        $this->getJson('/api/v1/people/'.$person->id.'/person-markas')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/people/'.$person->id.'/person-markas', ['marka_id' => $marka->id])->assertForbidden();
        $this->putJson('/api/v1/people/'.$person->id.'/person-markas/'.$assignment->id, ['marka_id' => $marka->id, 'version' => 1])->assertForbidden();
        $this->deleteJson('/api/v1/people/'.$person->id.'/person-markas/'.$assignment->id, ['version' => 1])->assertForbidden();
        $this->actingAs($this->operator(['markas.view'], 'No person access'));
        $this->getJson('/api/v1/people/'.$person->id.'/person-markas')->assertForbidden();
        $admin = User::factory()->create(['role_id' => Role::where('name', 'Admin')->firstOrFail()->id]);
        $this->actingAs($admin);
        $this->getJson('/api/v1/person-markas?context=management')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/person-markas/'.$private->id.'?context=management')->assertOk();
        $this->getJson('/api/v1/people/'.$hidden->id.'/person-markas?context=management')->assertOk();
        $this->postJson('/api/v1/people/'.$hidden->id.'/person-markas', ['marka_id' => $marka->id])->assertUnprocessable()->assertJsonValidationErrors('marka_id');
        $inactive = Person::factory()->create(['status' => false]);
        $this->postJson('/api/v1/people/'.$inactive->id.'/person-markas', ['marka_id' => $marka->id])->assertUnprocessable()->assertJsonValidationErrors('record');
    }
}
