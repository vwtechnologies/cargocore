<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\Country;
use Illuminate\Database\QueryException;
use Tests\ErpTestCase;

class CountryDisplayOrderTest extends ErpTestCase
{
    public function test_inserting_at_an_occupied_position_shifts_countries_including_disabled_records(): void
    {
        $this->administrator();
        $first = Country::factory()->create(['name' => 'Pakistan', 'display_sequence' => 1]);
        $second = Country::factory()->create(['name' => 'China', 'display_sequence' => 2, 'status' => false]);
        $third = Country::factory()->create(['name' => 'United Kingdom', 'display_sequence' => 3]);
        $new = $this->createRecord('countries', ['name' => 'New country', 'display_sequence' => 1]);

        $this->assertSame(1, $new['display_sequence']);
        $this->assertArrayNotHasKey('display_order_guard', $new);
        foreach ([$first, $second, $third] as $index => $country) {
            $this->assertSame($index + 2, $country->fresh()->display_sequence);
            $this->assertSame(2, $country->fresh()->version);
            $audit = AuditEvent::where('entity', 'countries')->where('record_id', $country->id)->firstOrFail();
            $this->assertSame(['before' => $index + 1, 'after' => $index + 2], $audit->changes['display_sequence']);
        }
        $this->getJson('/api/v1/countries?context=management')->assertOk()->assertJsonPath('data.*.id', [$new['id'], $first->id, $second->id, $third->id])->assertJsonPath('data.*.display_sequence', [1, 2, 3, 4]);
        $this->getJson('/api/v1/countries?context=lookup')->assertOk()->assertJsonPath('data.*.id', [$new['id'], $first->id, $third->id]);
        $this->putJson('/api/v1/countries/'.$first->id, ['name' => 'Stale edit', 'version' => 1])->assertConflict();
    }

    public function test_inserting_in_the_middle_preserves_earlier_positions(): void
    {
        $this->administrator();
        $first = Country::factory()->create();
        $second = Country::factory()->create();
        $third = Country::factory()->create();
        $new = $this->createRecord('countries', ['name' => 'Middle country', 'display_sequence' => 2]);
        $this->assertSame(1, $first->fresh()->display_sequence);
        $this->assertSame(1, $first->fresh()->version);
        $this->assertSame(3, $second->fresh()->display_sequence);
        $this->assertSame(4, $third->fresh()->display_sequence);
        $this->getJson('/api/v1/countries?context=management')->assertJsonPath('data.*.id', [$first->id, $new['id'], $second->id, $third->id]);
    }

    public function test_editing_swaps_only_the_two_positions_in_both_directions(): void
    {
        $this->administrator();
        $first = Country::factory()->create(['display_sequence' => 1]);
        $middle = Country::factory()->create(['display_sequence' => 2]);
        $last = Country::factory()->create(['display_sequence' => 3]);
        $this->putJson('/api/v1/countries/'.$last->id, ['name' => $last->name, 'display_sequence' => 1, 'version' => 1])->assertOk()->assertJsonPath('data.display_sequence', 1);
        $this->assertSame(3, $first->fresh()->display_sequence);
        $this->assertSame(2, $middle->fresh()->display_sequence);
        $this->assertSame(1, $middle->fresh()->version);
        $this->getJson('/api/v1/countries?context=management')->assertJsonPath('data.*.id', [$last->id, $middle->id, $first->id]);
        $this->assertSame(['before' => 3, 'after' => 1], AuditEvent::where('record_id', $last->id)->where('entity', 'countries')->firstOrFail()->changes['display_sequence']);
        $this->putJson('/api/v1/countries/'.$last->id, ['name' => $last->name, 'display_sequence' => 3, 'version' => 2])->assertOk();
        $this->getJson('/api/v1/countries?context=management')->assertJsonPath('data.*.id', [$first->id, $middle->id, $last->id])->assertJsonPath('data.*.display_sequence', [1, 2, 3]);
        $this->assertSame(3, $first->fresh()->version);
    }

    public function test_unchanged_orders_and_omitted_orders_on_edit_do_not_move_other_countries(): void
    {
        $this->administrator();
        $first = Country::factory()->create();
        $second = Country::factory()->create();
        $this->putJson('/api/v1/countries/'.$second->id, ['name' => $second->name, 'display_sequence' => 2, 'version' => 1])->assertOk();
        $this->putJson('/api/v1/countries/'.$second->id, ['name' => $second->name, 'short_name' => 'SC', 'version' => 2])->assertOk()->assertJsonPath('data.display_sequence', 2);
        $this->assertSame(1, $first->fresh()->version);
        $new = $this->createRecord('countries', ['name' => 'Appended country']);
        $this->assertSame(3, $new['display_sequence']);
    }

    public function test_deleted_countries_do_not_reserve_display_orders(): void
    {
        $this->administrator();
        $country = Country::factory()->create();
        $this->deleteJson('/api/v1/countries/'.$country->id, ['version' => 1])->assertNoContent();
        $new = $this->createRecord('countries', ['name' => 'Replacement country', 'display_sequence' => 1]);
        $this->assertSame(1, $new['display_sequence']);
        $this->assertSoftDeleted($country);
    }

    public function test_invalid_and_stale_edits_do_not_reorder_countries(): void
    {
        $this->administrator();
        $first = Country::factory()->create();
        $second = Country::factory()->create();
        foreach ([0, -1, 1.5] as $order) {
            $this->postJson('/api/v1/countries', ['name' => 'Invalid country', 'display_sequence' => $order])->assertUnprocessable()->assertJsonValidationErrors('display_sequence');
        }
        $this->putJson('/api/v1/countries/'.$second->id, ['name' => $second->name, 'display_sequence' => 1, 'version' => 0])->assertConflict();
        $this->postJson('/api/v1/countries', ['name' => $first->name, 'display_sequence' => 1])->assertUnprocessable();
        $this->assertSame(1, $first->fresh()->display_sequence);
        $this->assertSame(2, $second->fresh()->display_sequence);
        $this->assertSame(0, AuditEvent::where('entity', 'countries')->count());
    }

    public function test_order_overflow_is_rejected_without_partial_changes(): void
    {
        $this->administrator();
        $country = Country::factory()->create(['display_sequence' => 2147483647]);
        $this->postJson('/api/v1/countries', ['name' => 'Overflow', 'display_sequence' => 2147483647])->assertUnprocessable()->assertJsonValidationErrors('display_sequence');
        $this->postJson('/api/v1/countries', ['name' => 'Overflow append'])->assertUnprocessable()->assertJsonValidationErrors('display_sequence');
        $this->assertSame(2147483647, $country->fresh()->display_sequence);
        $this->assertSame(1, $country->fresh()->version);
        $this->assertSame(1, Country::count());
    }

    public function test_database_rejects_duplicate_orders_even_for_disabled_countries(): void
    {
        $this->administrator();
        Country::factory()->create(['display_sequence' => 1, 'status' => false]);
        $this->expectException(QueryException::class);
        Country::factory()->create(['display_sequence' => 1]);
    }
}
