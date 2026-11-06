<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Modules\Shared\Audit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UserRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(bool $audit = true): void
    {
        DB::transaction(function () use ($audit): void {
            DB::table('record_locks')->where('name', 'access')->lockForUpdate()->first();
            $role = Role::firstOrCreate(['name' => 'USER'], ['status' => true, 'is_system' => false]);
            $created = $role->wasRecentlyCreated;
            $before = $created ? [] : $role->load('permissions')->toArray();
            foreach (self::permissions() as $permission) {
                Permission::firstOrCreate(['name' => $permission]);
            }
            $actual = $role->permissions()->pluck('name')->sort()->values()->all();
            $expected = collect(self::permissions())->sort()->values()->all();
            if (! $created && $actual === $expected && $role->name === 'USER' && $role->status) {
                return;
            }
            $role->fill(['name' => 'USER', 'status' => true, 'version' => $created ? 1 : $role->version + 1])->save();
            $role->permissions()->sync(Permission::whereIn('name', self::permissions())->pluck('id'));
            $role->unsetRelation('permissions');
            if ($audit) {
                Audit::record($created ? 'create' : 'update', 'roles', $role->id, $before, $role->load('permissions')->toArray());
            }
            if (! $created) {
                DB::table('sessions')->whereIn('user_id', User::where('role_id', $role->id)->select('id'))->delete();
            }
        });
    }

    public static function permissions(): array
    {
        $permissions = ['companies.view', 'geography.view', 'banks.view'];
        foreach (['people', 'associations', 'employee-details', 'documents', 'person-accounts', 'markas'] as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                $permissions[] = $module.'.'.$action;
            }
        }

        return $permissions;
    }
}
