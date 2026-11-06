<?php

namespace App\Console\Commands;

use App\Models\Role;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ExportDemoRoleProfiles extends Command
{
    protected $signature = 'erp:export-demo-roles {path? : JSON destination} {--force : Replace an existing export}';

    protected $description = 'Export configured role permissions without accounts or business records';

    public function handle(): int
    {
        $path = $this->argument('path') ?: database_path('seeders/client-demo-roles.json');
        if (File::exists($path) && ! $this->option('force')) {
            $this->error('The role export exists. Use --force to replace it.');

            return self::FAILURE;
        }
        $profiles = Role::with('permissions')->orderBy('id')->get()->map(fn (Role $role): array => [
            'name' => $role->name,
            'status' => $role->status,
            'is_system' => $role->is_system,
            'permissions' => $role->permissions->pluck('name')->sort()->values()->all(),
        ])->all();
        File::put($path, json_encode($profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");
        $this->info('Exported '.count($profiles).' configured role profiles to '.$path);

        return self::SUCCESS;
    }
}
