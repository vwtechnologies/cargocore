<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->status || ! $user->role?->status) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            abort(401);
        }
        $definitions = [];
        foreach (EntityRegistry::all() as $key => $definition) {
            unset($definition['model']);
            $definition['capabilities'] = array_combine(['view', 'create', 'update', 'delete'], array_map(fn ($action) => $user->permits($definition['module'].'.'.$action), ['view', 'create', 'update', 'delete']));
            $definitions[$key] = $definition;
        }
        $companies = Company::query()->when(! $user->permits('companies.view'), fn ($query) => $query->whereRaw('1 = 0'));
        $portalCompanies = $user->companies()->where('companies.status', true)->orderBy('companies.id')->get(['companies.id', 'companies.name', 'companies.short_name', 'companies.is_default']);

        return response()->json(['user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'role' => $user->role->name],
            'permissions' => array_values(array_filter(EntityRegistry::permissions(), fn ($p) => $user->permits($p) && (! str_starts_with($p, 'roles.') || $user->isSuperAdmin()))),
            'companies' => $companies->where('companies.status', true)->get(['companies.id', 'companies.name', 'companies.short_name', 'companies.is_default']), 'portal_companies' => $portalCompanies, 'entities' => $definitions]);
    }
}
