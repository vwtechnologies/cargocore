<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Modules\Access\Access;
use App\Modules\Shared\Audit;
use App\Modules\Shared\DomainRules;
use App\Modules\Shared\EntityRegistry;
use App\Modules\Shared\UppercaseData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AccessController extends Controller
{
    private function manageable(User $actor, User $target): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }
        abort_if($target->role?->name === 'Super Admin', 404, 'Account is unavailable.');
        abort_if($target->role?->name === 'Admin' && $actor->role?->name !== 'Admin', 403, 'You may manage subordinate accounts only.');
        abort_if(array_diff($target->role?->permissions->pluck('name')->all() ?? [], $actor->role?->permissions->pluck('name')->all() ?? []), 403, 'Account has permissions outside your role.');
    }

    private function userData(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'status' => $user->status, 'version' => $user->version, 'person_id' => $user->person_id, 'person_name' => request()->user()?->permits('people.view') ? $user->person?->name : null, 'role_id' => $user->role_id, 'role_name' => $user->role?->name, 'company_ids' => $user->companies->pluck('id')];
    }

    public function linkablePeople(Request $request): array
    {
        $actor = $request->user();
        Access::authorize($actor, 'users', 'view');
        Access::authorize($actor, 'people', 'view');
        $data = $request->validate(['user_id' => 'nullable|integer|min:1', 'id' => 'nullable|integer|min:1', 'search' => 'nullable|string|max:200', 'per_page' => 'nullable|integer|min:1|max:100']);
        if (! empty($data['user_id'])) {
            $this->manageable($actor, User::findOrFail($data['user_id']));
        }
        $query = Access::query('people', $actor)->where('status', true)
            ->whereDoesntHave('user', function (Builder $users) use ($data): void {
                if (! empty($data['user_id'])) {
                    $users->where('id', '!=', $data['user_id']);
                }
            });
        if (! empty($data['id'])) {
            $query->whereKey($data['id']);
        }
        if (! empty($data['search'])) {
            $search = '%'.addcslashes($data['search'], '%_\\').'%';
            $query->where(fn (Builder $people) => $people->where('name', 'like', $search)->orWhere('code', 'like', $search));
        }
        $page = $query->orderBy('name')->orderBy('id')->paginate($data['per_page'] ?? 100, ['id', 'name', 'code', 'status']);

        return ['data' => $page->items(), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]];
    }

    public function personUser(Request $request, int $person): array
    {
        Access::authorize($request->user(), 'people', 'view');
        Access::authorize($request->user(), 'users', 'view');
        Access::query('people', $request->user())->findOrFail($person);
        $user = User::with('role.permissions', 'companies')->where('person_id', $person)->first();
        if ($user) {
            $this->manageable($request->user(), $user);
        }

        return ['data' => $user ? $this->userData($user) : null];
    }

    public function users(Request $r, ?int $id = null): mixed
    {
        $actor = $r->user();
        Access::authorize($actor, 'users', $r->isMethod('get') ? 'view' : ($id ? 'update' : 'create'));
        if ($id && ! $r->isMethod('get')) {
            $this->manageable($actor, User::findOrFail($id));
        }
        if ($r->isMethod('get')) {
            $query = User::with('role.permissions', 'companies', 'person');
            if ($r->input('context') !== 'management') {
                $query->where('status', true)->whereHas('role', fn (Builder $role) => $role->where('status', true));
            }
            if (! $actor->isSuperAdmin()) {
                $permissions = $actor->role->permissions->pluck('id');
                $excludedRoles = $actor->role?->name === 'Admin' ? ['Super Admin'] : ['Super Admin', 'Admin'];
                $query->whereHas('role', fn (Builder $q) => $q->whereNotIn('name', $excludedRoles)->whereDoesntHave('permissions', fn (Builder $p) => $p->whereNotIn('permissions.id', $permissions)));
            }
            if ($r->filled('person_id')) {
                $query->where('person_id', $r->integer('person_id'));
            }
            if ($r->filled('id')) {
                $r->validate(['id' => 'integer|min:1']);
                $query->whereKey($r->integer('id'));
            }
            if ($r->filled('search')) {
                $s = '%'.mb_substr($r->input('search'), 0, 100).'%';
                $query->where(fn (Builder $q) => $q->where('name', 'like', $s)->orWhere('username', 'like', $s));
            }
            $page = $query->orderBy('name')->paginate(20);

            return ['data' => $page->getCollection()->map(fn (User $u) => $this->userData($u)), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]];
        }
        $r->merge([
            'name' => UppercaseData::text($r->input('name')),
            'username' => UppercaseData::text($r->input('username')),
            'email' => UppercaseData::text($r->input('email')),
        ]);
        $data = $r->validate(['name' => 'required|string|max:255', 'username' => ['required', 'string', 'max:80', 'regex:/^[a-zA-Z0-9_.-]+$/', Rule::unique('users')->ignore($id)], 'email' => ['nullable', 'email:rfc', 'max:255', Rule::unique('users')->ignore($id)],
            'person_id' => ['nullable', 'integer', Rule::exists('people', 'id')->whereNull('deleted_at'), Rule::unique('users', 'person_id')->ignore($id)], 'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->whereNull('deleted_at')->where('status', true)],
            'company_ids' => 'present|array', 'company_ids.*' => ['integer', 'distinct', Rule::exists('companies', 'id')->whereNull('deleted_at')->where('status', true)], 'status' => 'required|boolean',
            'password' => [$id ? 'nullable' : 'required', 'confirmed', Password::min(12)->letters()->numbers()], 'version' => $id ? 'required|integer' : 'nullable|integer']);

        return DB::transaction(function () use ($actor, $data, $id) {
            DB::table('record_locks')->where('name', 'access')->lockForUpdate()->first();
            $user = $id ? User::lockForUpdate()->findOrFail($id) : new User;
            if ($id) {
                $this->manageable($actor, $user);
                abort_if($user->version !== (int) $data['version'], 409, 'Account changed. Reload before saving.');
            }
            if (array_key_exists('person_id', $data) && (int) $data['person_id'] !== (int) $user->person_id) {
                Access::authorize($actor, 'people', 'view');
                if ($data['person_id'] !== null) {
                    $person = Access::query('people', $actor)->lockForUpdate()->findOrFail($data['person_id']);
                    if (! $person->status) {
                        DomainRules::fail('person_id', 'Select an active person.');
                    }
                    if (User::where('person_id', $person->id)->when($id, fn (Builder $users) => $users->where('id', '!=', $id))->exists()) {
                        DomainRules::fail('person_id', 'This person already has a user account. Unlink that account first.');
                    }
                }
            }
            $role = Role::with('permissions')->findOrFail($data['role_id']);
            if (! $actor->isSuperAdmin()) {
                abort_if($role->name === 'Super Admin' || ($role->name === 'Admin' && $actor->role?->name !== 'Admin'), 403, 'You may assign subordinate roles only.');
                abort_if(array_diff($role->permissions->pluck('name')->all(), $actor->role->permissions->pluck('name')->all()), 403, 'Cannot grant permissions outside your role.');
            }
            if ($id && $user->isSuperAdmin() && (! $data['status'] || $role->name !== 'Super Admin') && User::where('role_id', $user->role_id)->where('status', true)->count() <= 1) {
                DomainRules::fail('status', 'At least one active Super Admin must remain.');
            }
            $before = $id ? $this->userData($user) : [];
            $companies = $data['company_ids'];
            $password = $data['password'] ?? null;
            unset($data['company_ids'],$data['password'],$data['version']);
            $user->fill($data);
            if ($password) {
                $user->password = $password;
                $user->must_change_password = false;
                $user->remember_token = null;
            }
            $user->version = ($id ? $user->version : 0) + 1;
            $user->save();
            $user->companies()->sync($companies);
            $user->unsetRelations();
            if ($id) {
                DB::table('sessions')->where('user_id', $id)->delete();
            }
            Audit::record($id ? 'update' : 'create', 'users', $user->id, $before, $this->userData($user));
            if ($password && $id) {
                Audit::record('password_reset', 'users', $user->id);
            }

            return response()->json(['data' => $this->userData($user)], $id ? 200 : 201);
        });
    }

    public function roles(Request $r, ?int $id = null): mixed
    {
        $actor = $r->user();
        if ($r->isMethod('get')) {
            abort_unless($actor->isSuperAdmin() || $actor->permits('users.view'), 403);
            abort_if($r->input('context') === 'management' && ! $actor->isSuperAdmin(), 403);
            $query = Role::with('permissions');
            if ($r->input('context') !== 'management') {
                $query->where('status', true);
            }
            if (! $actor->isSuperAdmin()) {
                $excludedRoles = $actor->role?->name === 'Admin' ? ['Super Admin'] : ['Super Admin', 'Admin'];
                $query->whereNotIn('name', $excludedRoles)->whereDoesntHave('permissions', fn (Builder $q) => $q->whereNotIn('permissions.id', $actor->role->permissions->pluck('id')));
            }

            return ['data' => $query->orderBy('id')->get(), 'permissions' => $actor->isSuperAdmin() ? EntityRegistry::permissions() : []];
        }
        Access::authorize($actor, 'roles', $id ? 'update' : 'create');
        $existing = $id ? Role::findOrFail($id) : null;
        if (! $existing?->is_system) {
            $r->merge(['name' => UppercaseData::text($r->input('name'))]);
        }
        $data = $r->validate(['name' => ['required', 'string', 'max:100', Rule::unique('roles')->ignore($id)], 'status' => 'required|boolean', 'permissions' => 'present|array', 'permissions.*' => ['string', 'distinct', Rule::in(EntityRegistry::permissions())], 'version' => $id ? 'required|integer' : 'nullable|integer']);

        return DB::transaction(function () use ($data, $id) {
            DB::table('record_locks')->where('name', 'access')->lockForUpdate()->first();
            $role = $id ? Role::lockForUpdate()->findOrFail($id) : new Role;
            if ($id) {
                abort_if($role->version !== (int) $data['version'], 409, 'Role changed. Reload before saving.');
            }
            if ($role->is_system && ($role->name !== $data['name'] || ! $data['status'])) {
                DomainRules::fail('name', 'System roles cannot be renamed or made inactive.');
            }
            if (! $role->is_system && in_array(mb_strtoupper($data['name']), ['ADMIN', 'SUPER ADMIN'], true)) {
                DomainRules::fail('name', 'This name is reserved.');
            }
            if ($role->name === 'Super Admin') {
                DomainRules::fail('permissions', 'Super Admin always has all permissions.');
            }
            if (array_filter($data['permissions'], fn ($p) => str_starts_with($p, 'roles.'))) {
                DomainRules::fail('permissions', 'Only Super Admin can manage roles and permissions.');
            }
            $before = $role->exists ? $role->load('permissions')->toArray() : [];
            $role->fill(['name' => $data['name'], 'status' => $data['status'], 'version' => ($id ? $role->version : 0) + 1])->save();
            $role->permissions()->sync(Permission::whereIn('name', $data['permissions'])->pluck('id'));
            $role->load('permissions');
            DB::table('sessions')->whereIn('user_id', User::where('role_id', $role->id)->select('id'))->delete();
            Audit::record($id ? 'update' : 'create', 'roles', $role->id, $before, $role->toArray());

            return response()->json(['data' => $role], $id ? 200 : 201);
        });
    }
}
