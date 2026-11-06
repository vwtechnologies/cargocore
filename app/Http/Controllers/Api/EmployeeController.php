<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeProfile;
use App\Models\PersonClassification;
use App\Modules\Access\Access;
use App\Modules\Shared\Audit;
use App\Modules\Shared\DomainRules;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function handle(Request $r, int $person): mixed
    {
        Access::authorize($r->user(), 'people', 'view');
        $people = Access::query('people', $r->user());
        if (! $r->isMethod('get') || $r->input('context') !== 'management') {
            VisibleRecords::apply($people, 'people');
        }
        $identity = $people->findOrFail($person);
        Access::authorize($r->user(), 'employee-details', $r->isMethod('get') ? 'view' : (EmployeeProfile::where('person_id', $person)->exists() ? 'update' : 'create'));
        $eligible = $identity->is_employee || VisibleRecords::apply(PersonClassification::query(), 'classifications')->whereHas('businessType', fn ($q) => $q->where('is_employee', true))->whereHas('association', fn ($q) => $q->where('person_id', $person))->exists();
        if ($r->isMethod('get')) {
            return ['data' => EmployeeProfile::with(['types' => fn ($types) => $types->where('status', true)])->where('person_id', $person)->first(), 'eligible' => $eligible];
        }
        if (! $eligible) {
            DomainRules::fail('record', 'Mark this person as an Employee in Personal Details or assign an active Employee business role before editing employee details.');
        }
        $data = $r->validate(['joining_date' => 'sometimes|nullable|date_format:Y-m-d', 'person_version' => 'required_with:joining_date|integer', 'salary' => ['nullable', 'regex:/^\d{1,17}(\.\d{1,2})?$/'], 'type_ids' => 'required|array|min:1', 'type_ids.*' => ['integer', 'distinct', Rule::exists('employee_types', 'id')->whereNull('deleted_at')->where('status', true)], 'version' => 'required|integer']);

        return DB::transaction(function () use ($r, $person, $data) {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            if (array_key_exists('joining_date', $data)) {
                Access::authorize($r->user(), 'people', 'update');
                $identity = Access::query('people', $r->user())->whereKey($person)->lockForUpdate()->firstOrFail();
                abort_if($identity->version !== (int) ($data['person_version'] ?? -1), 409, 'Person changed. Reload before saving.');
                $beforePerson = $identity->toArray();
                $identity->joining_date = $data['joining_date'];
                $identity->version++;
                $identity->save();
                Audit::record('update', 'people', $identity->id, $beforePerson, $identity->toArray());
            }
            $profile = EmployeeProfile::where('person_id', $person)->lockForUpdate()->first();
            abort_if(($profile?->version ?? 0) !== (int) $data['version'], 409, 'Employee details changed. Reload before saving.');
            $before = $profile?->load('types')->toArray() ?? [];
            $profile ??= new EmployeeProfile(['person_id' => $person, 'version' => 0]);
            $profile->salary = $data['salary'];
            $profile->version++;
            $profile->save();
            $retainedTypes = $profile->types()->where('employee_types.status', false)->pluck('employee_types.id')->all();
            $profile->types()->sync(array_unique([...$retainedTypes, ...$data['type_ids']]));
            $profile->load('types');
            Audit::record('update', 'employee-details', $profile->id, $before, $profile->toArray());

            return ['data' => $profile->load(['types' => fn ($types) => $types->where('status', true)]), 'eligible' => true];
        });
    }
}
