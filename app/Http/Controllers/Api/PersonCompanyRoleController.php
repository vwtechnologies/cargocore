<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BusinessType;
use App\Models\Company;
use App\Models\Person;
use App\Models\PersonCompany;
use App\Modules\Access\Access;
use App\Modules\Shared\Audit;
use App\Modules\Shared\RecordService;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PersonCompanyRoleController extends Controller
{
    public function __construct(private RecordService $records) {}

    private function result(?PersonCompany $association): array
    {
        $roles = $association?->classifications()->withTrashed()->orderBy('id')->get();

        return ['data' => $association ? $this->records->serialize('associations', $association) + ['is_deleted' => $association->trashed()] : null,
            'classifications' => $roles?->map(fn ($role) => $this->records->serialize('classifications', $role) + ['is_deleted' => $role->trashed()])->all() ?? [],
            'classification_versions' => $roles?->mapWithKeys(fn ($role) => [$role->id => $role->version])->all() ?: (object) []];
    }

    public function handle(Request $request, int $person, int $company): array
    {
        $actor = $request->user();
        Access::authorize($actor, 'people', 'view');
        Access::authorize($actor, 'companies', 'view');
        Access::authorize($actor, 'associations', 'view');
        Access::lookup($actor, 'business-types');
        Access::company($actor, $company);
        Access::query('people', $actor)->findOrFail($person);
        Company::findOrFail($company);
        if ($request->isMethod('get')) {
            return $this->result(PersonCompany::withTrashed()->where('person_id', $person)->where('company_id', $company)->first());
        }
        $input = $request->validate(['version' => 'required|integer|min:0', 'classification_versions' => 'present|array', 'classification_versions.*' => 'integer|min:1',
            'items' => 'present|array|max:100', 'items.*.business_type_id' => 'required|integer|distinct', 'items.*.opening_balance' => ['nullable', 'regex:/^-?\d{1,17}(\.\d{1,2})?$/']]);

        return DB::transaction(function () use ($actor, $person, $company, $input) {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            $association = PersonCompany::withTrashed()->where('person_id', $person)->where('company_id', $company)->lockForUpdate()->first();
            Access::authorize($actor, 'associations', $association ? 'update' : 'create');
            $current = $association?->classifications()->withTrashed()->lockForUpdate()->get();
            $actualVersions = $current?->mapWithKeys(fn ($role) => [$role->id => $role->version])->all() ?? [];
            $versions = array_map('intval', $input['classification_versions']);
            ksort($versions);
            ksort($actualVersions);
            abort_if(($association?->version ?? 0) !== (int) $input['version'] || $actualVersions !== $versions, 409, 'Company roles changed. Reload and review before saving.');
            $ids = array_map('intval', array_column($input['items'], 'business_type_id'));
            abort_unless(VisibleRecords::apply(BusinessType::query(), 'business-types')->whereKey($ids)->count() === count($ids), 422, 'Select active business roles.');
            if ($ids) {
                abort_unless(VisibleRecords::apply(Person::query(), 'people')->whereKey($person)->exists() && VisibleRecords::apply(Company::query(), 'companies')->whereKey($company)->exists(), 422, 'Activate the person and company before assigning roles.');
            }
            if (! $association && ! $ids) {
                return $this->result(null);
            }
            $childRequest = function (array $data) use ($actor): Request {
                $child = Request::create('/', 'PUT', $data);
                $child->setUserResolver(fn () => $actor);

                return $child;
            };
            if ($association?->trashed()) {
                $before = $association->toArray();
                $association->restore();
                Audit::record('restore', 'associations', $association->id, $before, $association->toArray(), $company);
            }
            $association = $this->records->save($childRequest(['company_id' => $company, 'status' => (bool) $ids, 'version' => $association?->version]), 'associations', $association?->id, ['person_id' => $person]);
            foreach ($input['items'] as $item) {
                $item['business_type_id'] = (int) $item['business_type_id'];
                $role = $current?->firstWhere('business_type_id', $item['business_type_id']);
                if ($role?->trashed()) {
                    $before = $role->toArray();
                    $role->restore();
                    Audit::record('restore', 'classifications', $role->id, $before, $role->toArray(), $company);
                }
                $this->records->save($childRequest($item + ['status' => true, 'version' => $role?->version]), 'classifications', $role?->id, ['person_company_id' => $association->id]);
            }
            foreach ($current ?? [] as $role) {
                if ($role->status && ! $role->trashed() && ! in_array($role->business_type_id, $ids, true) && BusinessType::whereKey($role->business_type_id)->where('status', true)->exists()) {
                    $this->records->save($childRequest(['business_type_id' => $role->business_type_id, 'opening_balance' => $role->opening_balance, 'status' => false, 'version' => $role->version]), 'classifications', $role->id, ['person_company_id' => $association->id]);
                }
            }

            return $this->result($association->refresh());
        }, 3);
    }
}
