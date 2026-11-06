<?php

namespace App\Modules\Shared;

use App\Models\Bank;
use App\Models\EmployeeProfile;
use App\Models\PersonCompany;
use App\Models\Record;
use App\Modules\Access\Access;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RecordService
{
    public function parent(Request $request, string $entity, ?string $parentEntity, ?int $parentId): array
    {
        $definition = EntityRegistry::get($entity);
        $parent = $definition['parent'];
        if (! $parent) {
            abort_if($parentEntity !== null, 404);

            return [];
        }
        if ($parentEntity === null) {
            return [];
        }
        abort_unless($parent['entity'] === $parentEntity, 404);
        $parentDef = EntityRegistry::get($parentEntity);
        Access::authorize($request->user(), $parentDef['module'], 'view');
        $ancestor = $parentDef['parent'];
        while ($ancestor) {
            $ancestorDef = EntityRegistry::get($ancestor['entity']);
            Access::authorize($request->user(), $ancestorDef['module'], 'view');
            $ancestor = $ancestorDef['parent'];
        }
        $record = Access::query($parentEntity, $request->user())->findOrFail($parentId);

        return [$parent['key'] => $record->id];
    }

    public function serialize(string $entity, Record $record): array
    {
        $data = $record->attributesToArray();
        if ($entity === 'people') {
            $record->loadMissing('city.country');
            $data['city_name'] = $record->city?->status && $record->city?->country?->status ? $record->city->name : null;
        }
        if ($entity === 'banks') {
            $record->loadMissing('country');
            $data['country_name'] = $record->country?->name;
        }
        if ($entity === 'branches') {
            $record->loadMissing('city.country');
            $data['country_id'] = $record->city->country_id;
            $data['country_name'] = $record->city->country?->name;
            $data['city_name'] = $record->city->name;
        }
        if ($entity === 'officers') {
            $record->loadMissing('person', 'branch');
            $data['person_name'] = $record->person?->name;
            $data['branch_name'] = $record->branch?->name ?? 'Bank-wide';
        }
        if ($entity === 'accounts') {
            $record->loadMissing('branch.bank', 'branch.city.country');
            $branch = $record->branch;
            $data += ['bank_id' => $branch?->bank_id, 'country_id' => $branch?->city?->country_id, 'city_id' => $branch?->city_id, 'country_name' => $branch?->city?->country?->name, 'bank_name' => $branch?->bank?->name, 'city_name' => $branch?->city?->name, 'branch_name' => $branch?->name];
        }
        if ($entity === 'associations') {
            $data['company_name'] = $record->company?->name;
        }
        if ($entity === 'classifications') {
            $data['business_type_name'] = $record->businessType?->name;
        }
        if ($entity === 'person-markas') {
            $data['marka_code'] = $record->marka?->status ? $record->marka->code : null;
            $data['marka_description'] = $record->marka?->status ? $record->marka->description : null;
        }

        return $data;
    }

    public function save(Request $request, string $entity, ?int $id, array $parent): Record
    {
        $definition = EntityRegistry::get($entity);
        Access::authorize($request->user(), $definition['module'], $id ? 'update' : 'create');
        abort_if($definition['parent'] && ! $parent, 422, 'Use the parent resource to save a child record.');

        return DB::transaction(function () use ($request, $entity, $id, $parent, $definition) {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            $record = $id ? Access::query($entity, $request->user())->where($parent)->lockForUpdate()->findOrFail($id) : null;
            $input = UppercaseData::record($entity, $request->all());
            if ($entity === 'people' && ! empty($input['cnic'])) {
                $input['cnic'] = preg_replace('/[\s-]+/', '', $input['cnic']);
            }
            if ($entity === 'branches' && empty($input['country_id'])) {
                $bankId = $parent['bank_id'] ?? ($record ? $record->bank_id : null);
                if ($bankId) {
                    $bank = Bank::find($bankId);
                    if ($bank && $bank->country_id) {
                        $input['country_id'] = $bank->country_id;
                    }
                }
            }
            $rules = [];
            foreach ($definition['fields'] as $key => $field) {
                $type = $field['type'] ?? 'text';
                $rules[$key] = [($field['required'] ?? false) ? 'required' : 'nullable'];
                if ($type === 'boolean') {
                    $rules[$key] = ['sometimes', 'boolean'];
                } elseif ($type === 'number') {
                    $rules[$key][] = 'integer';
                    $rules[$key][] = 'min:'.($field['min'] ?? 0);
                    $rules[$key][] = 'max:2147483647';
                } elseif ($type === 'money') {
                    $rules[$key][] = 'regex:/^-?\d{1,17}(\.\d{1,2})?$/';
                } elseif ($type === 'date') {
                    $rules[$key][] = 'date_format:Y-m-d';
                } elseif ($type === 'list') {
                    $rules[$key][] = 'array';
                    $rules[$key][] = 'max:30';
                    $rules[$key.'.*'] = ['required', 'string', 'max:50'];
                } elseif ($type === 'reference') {
                    $ref = EntityRegistry::get($field['entity']);
                    $table = (new $ref['model'])->getTable();
                    $rules[$key][] = 'integer';
                    $rules[$key][] = Rule::exists($table, 'id')->whereNull('deleted_at');
                } else {
                    $rules[$key][] = 'string';
                    $rules[$key][] = 'max:'.($field['max'] ?? 255);
                    if (in_array($type, ['email', 'url'], true)) {
                        $rules[$key][] = $type === 'url' ? 'url:http,https' : 'email:rfc';
                    }
                }
                if ($field['unique'] ?? false) {
                    $unique = Rule::unique((new $definition['model'])->getTable(), $key)->ignore($id);
                    if ($entity === 'countries' && $key === 'name') {
                        $unique->withoutTrashed();
                    }
                    $rules[$key][] = $unique;
                }
            }
            if ($entity === 'people') {
                $rules['cnic'][] = 'regex:/^[0-9]{13}$/';
                $rules['date_of_birth'][] = 'before_or_equal:today';
                $rules['employee'] = ['sometimes', 'array:type_ids,version'];
                $rules['employee.type_ids'] = ['present_with:employee', 'array', 'max:100'];
                $rules['employee.type_ids.*'] = ['integer', 'distinct', Rule::exists('employee_types', 'id')->whereNull('deleted_at')->where('status', true)];
                $rules['employee.version'] = ['present_with:employee', 'integer', 'min:0'];
            }
            if ($id) {
                $rules['version'] = ['required', 'integer'];
            }
            $data = Validator::make($input, $rules)->validate();
            if ($record && $record->version !== (int) $data['version']) {
                abort(409, 'This record changed after you opened it. Reload and review before saving.');
            }
            unset($data['version']);
            $employee = $data['employee'] ?? null;
            unset($data['employee']);
            if ($entity === 'people' && ($employee !== null || (array_key_exists('is_employee', $data) && (bool) $data['is_employee'] !== (bool) $record?->is_employee))) {
                Access::authorize($request->user(), 'employee-details', $record && EmployeeProfile::where('person_id', $record->id)->exists() ? 'update' : 'create');
            }
            foreach ($definition['fields'] as $key => $field) {
                if (($field['immutable'] ?? false) && $record && ($data[$key] ?? null) !== $record->getAttribute($key)) {
                    DomainRules::fail($key, 'This code cannot be changed after creation.');
                }
                if (($field['type'] ?? '') === 'reference' && ! empty($data[$key])) {
                    $ref = EntityRegistry::get($field['entity']);
                    Access::lookup($request->user(), $ref['module']);
                    $selected = Access::query($field['entity'], $request->user())->findOrFail($data[$key]);
                    if (! VisibleRecords::apply(Access::query($field['entity'], $request->user()), $field['entity'])->whereKey($selected->id)->exists() && (! $record || (int) $record->getAttribute($key) !== (int) $data[$key])) {
                        DomainRules::fail($key, 'Select an active record.');
                    }
                }
            }
            if (! $id && $definition['parent']) {
                $parentDef = EntityRegistry::get($definition['parent']['entity']);
                $parentRecord = $parentDef['model']::findOrFail(array_values($parent)[0]);
                if (! VisibleRecords::apply($parentDef['model']::query(), $definition['parent']['entity'])->whereKey($parentRecord->id)->exists()) {
                    DomainRules::fail('record', 'Activate the parent before adding related records.');
                }
            }
            $data = array_merge($data, $parent);
            DomainRules::check($entity, $data, $record, $request->user());
            if ($entity === 'countries') {
                $data['display_sequence'] = CountryOrder::prepare($record, isset($data['display_sequence']) ? (int) $data['display_sequence'] : null);
            }
            foreach ($definition['fields'] as $key => $field) {
                if ($field['virtual'] ?? false) {
                    unset($data[$key]);
                }
            }
            $before = $record?->toArray() ?? [];
            $record ??= new $definition['model'];
            $record->fill($data);
            if ($id) {
                $record->version++;
            }
            $record->save();
            if ($definition['prefix'] && ! $record->code) {
                $record->code = $definition['prefix'].'-'.str_pad((string) $record->id, 6, '0', STR_PAD_LEFT);
                $record->save();
            }
            if ($entity === 'people' && $employee !== null) {
                $record->refresh();
                if (! $record->is_employee) {
                    DomainRules::fail('employee.type_ids', 'Mark this person as an Employee before assigning employee types.');
                }
                if (! $record->status) {
                    DomainRules::fail('employee.type_ids', 'Activate the person before assigning employee types.');
                }
                $profile = EmployeeProfile::where('person_id', $record->id)->lockForUpdate()->first();
                abort_if(($profile?->version ?? 0) !== (int) $employee['version'], 409, 'Employee details changed. Reload and review before saving.');
                $beforeEmployee = $profile?->load('types')->toArray() ?? [];
                $retainedTypes = $profile?->types()->where('employee_types.status', false)->pluck('employee_types.id')->all() ?? [];
                $profile ??= new EmployeeProfile(['person_id' => $record->id, 'version' => 0]);
                $profile->version++;
                $profile->save();
                $profile->types()->sync(array_unique([...$retainedTypes, ...$employee['type_ids']]));
                Audit::record($beforeEmployee ? 'update' : 'create', 'employee-details', $profile->id, $beforeEmployee, $profile->load('types')->toArray());
            }
            Audit::record($id ? 'update' : 'create', $entity, $record->id, $before, $record->toArray(), $this->companyId($entity, $record), $record->name ?? $record->code);

            return $record->refresh();
        }, 3);
    }

    public function delete(Request $request, string $entity, int $id, array $parent): void
    {
        $definition = EntityRegistry::get($entity);
        Access::authorize($request->user(), $definition['module'], 'delete');
        abort_if($definition['parent'] && ! $parent, 422, 'Use the parent resource to delete a child record.');
        DB::transaction(function () use ($request, $entity, $id, $parent) {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            $record = Access::query($entity, $request->user())->where($parent)->lockForUpdate()->findOrFail($id);
            $request->validate(['version' => 'required|integer']);
            abort_if($record->version !== (int) $request->input('version'), 409, 'Record changed. Reload before deleting.');
            DomainRules::assertDeletable($entity, $record);
            $before = $record->toArray();
            $record->version++;
            $record->save();
            $record->delete();
            Audit::record('delete', $entity, $id, $before, [], $this->companyId($entity, $record), $record->name ?? $record->code);
        });
    }

    public function companyId(string $entity, Record $record): ?int
    {
        return match ($entity) {
            'companies' => $record->id,'sub-companies','associations' => $record->company_id,'classifications' => PersonCompany::find($record->person_company_id)?->company_id,default => null
        };
    }
}
