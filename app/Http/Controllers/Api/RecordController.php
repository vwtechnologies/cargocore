<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Access\Access;
use App\Modules\Shared\EntityRegistry;
use App\Modules\Shared\RecordService;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RecordController extends Controller
{
    public function __construct(private RecordService $records) {}

    public function batchClassifications(Request $request, int $association): mixed
    {
        $request->validate(['items' => 'required|array|min:1|max:30', 'items.*' => 'required|array']);
        $parent = $this->records->parent($request, 'classifications', 'associations', $association);

        return DB::transaction(function () use ($request, $parent) {
            $items = [];
            foreach ($request->input('items') as $item) {
                $child = Request::create('/', 'POST', $item);
                $child->setUserResolver(fn () => $request->user());
                $items[] = $this->records->serialize('classifications', $this->records->save($child, 'classifications', null, $parent));
            }

            return response()->json(['data' => $items], 201);
        });
    }

    public function handle(Request $request, string $entity, ?int $id = null, ?string $parentEntity = null, ?int $parentId = null): mixed
    {
        $definition = EntityRegistry::get($entity);
        $parent = $this->records->parent($request, $entity, $parentEntity, $parentId);
        if ($request->isMethod('post') || $request->isMethod('put') || $request->isMethod('patch')) {
            $record = $this->records->save($request, $entity, $id, $parent);

            return response()->json(['data' => $this->records->serialize($entity, $record)], $id ? 200 : 201);
        }
        if ($request->isMethod('delete')) {
            abort_unless($id, 404);
            $this->records->delete($request, $entity, $id, $parent);

            return response()->noContent();
        }
        if (! $id && $request->input('context') === 'lookup') {
            Access::lookup($request->user(), $definition['module']);
        } else {
            Access::authorize($request->user(), $definition['module'], 'view');
        }
        $ancestor = $definition['parent'];
        while ($ancestor) {
            $parentDefinition = EntityRegistry::get($ancestor['entity']);
            Access::authorize($request->user(), $parentDefinition['module'], 'view');
            $ancestor = $parentDefinition['parent'];
        }
        $request->validate(['context' => 'sometimes|in:management,lookup']);
        $query = Access::query($entity, $request->user())->where($parent);
        if ($request->input('context') !== 'management') {
            VisibleRecords::apply($query, $entity);
        }
        if ($id) {
            return response()->json(['data' => $this->records->serialize($entity, $query->findOrFail($id))]);
        }
        if ($request->filled('id')) {
            $request->validate(['id' => 'integer|min:1']);
            $query->whereKey($request->integer('id'));
        }
        if ($request->filled('ids')) {
            $ids = explode(',', (string) $request->input('ids'));
            Validator::make(['ids' => $ids], ['ids' => 'array|max:100', 'ids.*' => 'integer|min:1'])->validate();
            $query->whereKey($ids);
        }
        if ($entity === 'banks' && $request->filled('country_id')) {
            $country = $request->integer('country_id');
            $query->where(fn (Builder $bank) => $bank->where('country_id', $country)->orWhere(fn (Builder $global) => $global->whereNull('country_id')->whereHas('branches', fn (Builder $branch) => VisibleRecords::apply($branch, 'branches')->whereHas('city', fn (Builder $city) => $city->where('country_id', $country)))));
        }
        $allowedFilters = ['companies' => ['id'], 'sub-companies' => ['company_id'], 'cities' => ['country_id'], 'branches' => ['bank_id', 'city_id'], 'officers' => ['bank_id', 'bank_branch_id'], 'associations' => ['person_id', 'company_id'], 'classifications' => ['person_company_id'], 'contacts' => ['person_id'], 'accounts' => ['person_id'], 'person-markas' => ['person_id', 'marka_id']];
        foreach ($allowedFilters[$entity] ?? [] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }
        if ($entity === 'branches' && $request->filled('country_id')) {
            $query->whereHas('city', fn (Builder $q) => $q->where('country_id', $request->integer('country_id')));
        }
        if ($request->has('status') && $request->input('status') !== '') {
            $query->where('status', $request->boolean('status'));
        }
        if ($entity === 'people' && ($request->filled('company_id') || $request->filled('business_type_id'))) {
            if ($request->filled('company_id')) {
                Access::company($request->user(), $request->integer('company_id'));
            }
            $query->whereHas('associations', function (Builder $q) use ($request) {
                VisibleRecords::apply(Access::scope($q, 'associations', $request->user()), 'associations');
                if ($request->filled('company_id')) {
                    $q->where('company_id', $request->integer('company_id'));
                }
                if ($request->filled('business_type_id')) {
                    $q->whereHas('classifications', fn (Builder $c) => VisibleRecords::apply($c, 'classifications')->where('business_type_id', $request->integer('business_type_id')));
                }
            });
        }
        $fields = array_keys(array_filter($definition['fields'], fn ($f) => ! ($f['virtual'] ?? false) && ! in_array($f['type'] ?? 'text', ['list', 'reference'], true)));
        if ($definition['prefix'] && ! in_array('code', $fields, true)) {
            $fields[] = 'code';
        }
        $relatedSearch = match ($entity) {
            'branches' => ['city'], 'officers' => ['person', 'branch'], 'accounts' => ['branch', 'branch.bank'], 'associations' => ['company'], 'classifications' => ['businessType'], default => []
        };
        $relatedSort = match ($entity) {
            'branches' => ['city_name' => '(select name from cities where cities.id=bank_branches.city_id)'],
            'officers' => ['person_name' => '(select name from people where people.id=bank_officers.person_id)', 'branch_name' => '(select name from bank_branches where bank_branches.id=bank_officers.bank_branch_id)'],
            'accounts' => ['branch_name' => '(select name from bank_branches where bank_branches.id=person_bank_accounts.bank_branch_id)', 'bank_name' => '(select banks.name from banks join bank_branches on bank_branches.bank_id=banks.id where bank_branches.id=person_bank_accounts.bank_branch_id)'],
            'associations' => ['company_name' => '(select name from companies where companies.id=person_companies.company_id)'],
            'classifications' => ['business_type_name' => '(select name from business_types where business_types.id=person_classifications.business_type_id)'],
            'person-markas' => ['marka_code' => '(select code from markas where markas.id=person_markas.marka_id)', 'marka_description' => '(select description from markas where markas.id=person_markas.marka_id)'], default => []
        };
        if ($request->filled('search')) {
            $search = mb_substr($request->string('search')->toString(), 0, 200);
            $query->where(function (Builder $q) use ($fields, $search, $relatedSearch, $entity) {
                foreach (array_intersect($fields, ['name', 'code', 'description', 'cnic', 'email', 'phone', 'mobile', 'account_title', 'account_number', 'designation', 'label']) as $field) {
                    $q->orWhere($field, 'like', '%'.addcslashes($search, '%_\\').'%');
                }
                foreach ($relatedSearch as $relation) {
                    $q->orWhereHas($relation, fn (Builder $related) => $related->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'));
                }
                if ($entity === 'person-markas') {
                    $q->orWhereHas('marka', fn (Builder $related) => $related->where(fn (Builder $marka) => $marka->where('code', 'like', '%'.addcslashes($search, '%_\\').'%')->orWhere('description', 'like', '%'.addcslashes($search, '%_\\').'%')));
                }
            });
        }
        $sort = $request->input('sort', $entity === 'countries' ? 'display_sequence' : 'id');
        if (! in_array($sort, [...$fields, ...array_keys($relatedSort), 'id', 'created_at'], true)) {
            $sort = 'id';
        }
        $column = $relatedSort[$sort] ?? $query->getQuery()->getGrammar()->wrap($query->getModel()->qualifyColumn($sort));
        $query->orderByRaw($column.($request->input('direction') === 'desc' ? ' desc' : ' asc'));
        if ($sort !== 'id') {
            $query->orderBy('id');
        }
        if ($request->filled('position_of')) {
            $request->validate(['position_of' => 'required|integer|min:1']);
            $grammar = $query->getQuery()->getGrammar();
            $key = $grammar->wrap($query->getModel()->qualifyColumn('id'));
            $order = $column.($request->input('direction') === 'desc' ? ' desc' : ' asc').($sort === 'id' ? '' : ', '.$key.' asc');
            $window = 'order by '.$order;
            $ranked = (clone $query)->reorder()->selectRaw("$key as id, row_number() over ($window) as position, count(*) over () as total, lag($key) over ($window) as previous, lead($key) over ($window) as next, first_value($key) over ($window) as first, last_value($key) over ($window rows between unbounded preceding and unbounded following) as last");
            $navigation = DB::query()->fromSub($ranked->toBase(), 'navigation')->where('id', $request->integer('position_of'))->first();
            abort_unless($navigation, 404);

            return response()->json(['navigation' => collect($navigation)->except('id')->map(fn ($value) => $value === null ? null : (int) $value)]);
        }
        $relations = match ($entity) {
            'branches' => ['city.country'],'officers' => ['person', 'branch'],'accounts' => ['branch.bank', 'branch.city.country'],'associations' => ['company'],'classifications' => ['businessType'],'person-markas' => ['marka'],default => []
        };
        $page = $query->with($relations)->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json(['data' => $page->getCollection()->map(fn ($r) => $this->records->serialize($entity, $r)), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()]]);
    }
}
