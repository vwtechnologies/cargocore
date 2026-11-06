<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditEvent;
use App\Models\Role;
use App\Models\User;
use App\Modules\Access\Access;
use App\Modules\Shared\EntityRegistry;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private function auditQuery(Request $r): Builder
    {
        $query = AuditEvent::with('actor.role');
        if (! $r->user()->isSuperAdmin()) {
            if ($r->user()->role?->name === 'Admin') {
                $accounts = User::whereHas('role', fn (Builder $role) => $role->where('name', '!=', 'Super Admin'))->select('id');
                $query->where(fn (Builder $event) => $event->where('entity', '!=', 'users')->orWhereIn('record_id', $accounts));
                $query->where(fn (Builder $event) => $event->where('entity', '!=', 'roles')->orWhereNotIn('record_id', Role::withTrashed()->where('name', 'Super Admin')->select('id')));
            } else {
                $query->where(fn (Builder $q) => $q->whereNotIn('entity', ['users', 'roles'])->orWhere(fn (Builder $self) => $self->where('entity', 'users')->where('record_id', $r->user()->id)));
            }
        }

        return $query;
    }

    private function serializeAudit(Request $request, AuditEvent $event): array
    {
        $data = $event->toArray();
        $hideActor = ! $request->user()->isSuperAdmin() && $event->actor?->role?->name === 'Super Admin';
        $data['actor'] = ! $hideActor && $event->actor ? $event->actor->only(['id', 'name']) : null;
        if ($hideActor) {
            $data['user_id'] = null;
            $data['ip_address'] = null;
        }

        return $data;
    }

    public function show(Request $r): array
    {
        $counts = [];
        foreach (['companies', 'people', 'banks', 'markas'] as $entity) {
            $counts[$entity] = $r->user()->permits(EntityRegistry::get($entity)['module'].'.view') ? ['total' => VisibleRecords::apply(Access::query($entity, $r->user()), $entity)->count(), 'active' => VisibleRecords::apply(Access::query($entity, $r->user()), $entity)->count()] : null;
        }

        return ['counts' => $counts, 'recent_people' => $r->user()->permits('people.view') ? VisibleRecords::apply(Access::query('people', $r->user()), 'people')->latest()->limit(5)->get(['id', 'code', 'name', 'status', 'created_at']) : [],
            'recent_activity' => $r->user()->permits('audit.view') ? $this->auditQuery($r)->latest()->limit(6)->get()->map(fn (AuditEvent $event) => $this->serializeAudit($r, $event)) : [],
            'companies' => $r->user()->permits('companies.view') ? VisibleRecords::apply(Access::query('companies', $r->user()), 'companies')->withCount(['subCompanies' => fn (Builder $children) => VisibleRecords::apply($children, 'sub-companies')])->orderBy('name')->limit(6)->get(['id', 'name', 'short_name', 'status', 'is_default']) : []];
    }

    public function audit(Request $r): array
    {
        Access::authorize($r->user(), 'audit', 'view');
        $q = $this->auditQuery($r);
        foreach (['entity', 'action', 'user_id'] as $key) {
            if ($r->filled($key)) {
                if ($key === 'user_id' && ! $r->user()->isSuperAdmin() && User::whereKey($r->integer($key))->whereHas('role', fn (Builder $role) => $role->where('name', 'Super Admin'))->exists()) {
                    $q->whereRaw('1 = 0');

                    continue;
                }
                $q->where($key, $r->input($key));
            }
        }
        if ($r->filled('company_id')) {
            Access::company($r->user(), $r->integer('company_id'));
            $q->where('company_id', $r->integer('company_id'));
        }
        if ($r->filled('search')) {
            $s = '%'.mb_substr($r->input('search'), 0, 150).'%';
            $q->where(fn (Builder $v) => $v->where('record_label', 'like', $s)->orWhere('entity', 'like', $s)->orWhere('action', 'like', $s));
        }
        $page = $q->latest('id')->paginate(25);

        return ['data' => $page->getCollection()->map(fn (AuditEvent $event) => $this->serializeAudit($r, $event)), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]];
    }
}
