<?php

namespace App\Modules\Access;

use App\Models\Company;
use App\Models\User;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;

class Access
{
    public static function authorize(User $user, string $module, string $action): void
    {
        abort_unless(Gate::forUser($user)->allows("$module.$action") && ($module !== 'roles' || $user->isSuperAdmin()), 403, 'You do not have permission for this action.');
    }

    public static function company(User $user, int $companyId): void
    {
        Company::query()->findOrFail($companyId);
    }

    public static function scope(Builder $query, string $entity, User $user): Builder
    {
        return $query;
    }

    public static function lookup(User $user, string $module): void
    {
        $personLookup = ($module === 'business-types' && $user->permits('associations.view'))
            || ($module === 'employee-types' && $user->permits('employee-details.view'));
        abort_unless($user->permits($module.'.view') || $personLookup, 403, 'You do not have permission for this selection.');
    }

    public static function query(string $entity, User $user): Builder
    {
        $class = EntityRegistry::get($entity)['model'];

        return self::scope($class::query(), $entity, $user);
    }

    public static function companyIds(User $user): array
    {
        return $user->companies()->pluck('companies.id')->all();
    }
}
