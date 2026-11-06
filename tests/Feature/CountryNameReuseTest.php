<?php

namespace Tests\Feature;

use App\Models\Country;
use Illuminate\Database\QueryException;
use Tests\ErpTestCase;

class CountryNameReuseTest extends ErpTestCase
{
    public function test_a_deleted_country_name_can_be_created_again_without_restoring_old_records(): void
    {
        $this->administrator();
        $original = $this->createRecord('countries', ['name' => 'United Kingdom', 'short_name' => 'UK', 'display_sequence' => 3]);
        $this->deleteJson('/api/v1/countries/'.$original['id'], ['version' => $original['version']])->assertNoContent();
        $this->getJson('/api/v1/countries?context=management&search=United%20Kingdom')->assertOk()->assertJsonCount(0, 'data');

        $replacement = $this->createRecord('countries', ['name' => 'United Kingdom', 'short_name' => 'UK', 'display_sequence' => 3]);
        $this->assertNotSame($original['id'], $replacement['id']);
        $this->assertNotSame($original['code'], $replacement['code']);
        $this->assertArrayNotHasKey('name_guard', $replacement);
        $this->assertSoftDeleted('countries', ['id' => $original['id']]);
        $this->assertDatabaseHas('countries', ['id' => $replacement['id'], 'deleted_at' => null]);
        $this->getJson('/api/v1/countries?context=management&search=United%20Kingdom')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $replacement['id']);
        $this->getJson('/api/v1/countries/'.$original['id'].'?context=management')->assertNotFound();
        $this->assertDatabaseHas('audit_events', ['entity' => 'countries', 'action' => 'delete', 'record_id' => $original['id']]);
        $this->assertDatabaseHas('audit_events', ['entity' => 'countries', 'action' => 'create', 'record_id' => $replacement['id']]);

        $this->deleteJson('/api/v1/countries/'.$replacement['id'], ['version' => $replacement['version']])->assertNoContent();
        $third = $this->createRecord('countries', ['name' => 'United Kingdom', 'short_name' => 'UK']);
        $this->assertNotSame($replacement['id'], $third['id']);
        $this->assertSame(3, Country::withTrashed()->where('name', 'United Kingdom')->count());
    }

    public function test_existing_active_and_inactive_country_names_remain_unique_on_create_and_update(): void
    {
        $this->administrator();
        foreach ([true, false] as $status) {
            $country = Country::factory()->create(['status' => $status]);
            $this->postJson('/api/v1/countries', ['name' => $country->name, 'status' => true])->assertUnprocessable()->assertJsonValidationErrors('name');
            $other = Country::factory()->create();
            $this->putJson('/api/v1/countries/'.$other->id, ['name' => $country->name, 'version' => $other->fresh()->version])->assertUnprocessable()->assertJsonValidationErrors('name');
        }
    }

    public function test_a_country_can_be_renamed_to_a_deleted_name(): void
    {
        $this->administrator();
        $deleted = Country::factory()->create(['name' => 'United Kingdom']);
        $deleted->delete();
        $country = Country::factory()->create(['name' => 'Britain']);
        $this->putJson('/api/v1/countries/'.$country->id, ['name' => 'United Kingdom', 'short_name' => 'UK', 'version' => $country->fresh()->version])->assertOk()->assertJsonPath('data.name', 'UNITED KINGDOM');
        $this->assertSoftDeleted($deleted);
    }

    public function test_the_database_prevents_duplicate_names_for_non_deleted_countries(): void
    {
        $this->administrator();
        Country::factory()->create(['name' => 'United Kingdom', 'status' => false]);
        $this->expectException(QueryException::class);
        Country::factory()->create(['name' => 'United Kingdom']);
    }
}
