<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\Role;
use App\Models\User;
use App\Modules\Shared\Audit;
use App\Modules\Shared\EntityRegistry;
use App\Modules\Shared\UppercaseData;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

#[Signature('erp:uppercase-data')]
#[Description('Normalize existing text, usernames, emails and URLs to uppercase, preserving passwords, files and audit history')]
class UppercaseBusinessData extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = 0;
        foreach (EntityRegistry::all() as $entity => $definition) {
            $class = $definition['model'];
            $class::withTrashed()->chunkById(100, function ($records) use ($entity, &$count): void {
                foreach ($records as $record) {
                    $count += $this->normalize($record, $entity, fn (array $values): array => UppercaseData::record($entity, $values));
                }
            });
        }
        foreach ([User::class => ['name', 'username', 'email'], Document::class => ['document_type', 'document_number'], Role::class => ['name']] as $class => $fields) {
            $class::query()->chunkById(100, function ($records) use ($fields, &$count): void {
                foreach ($records as $record) {
                    if ($record instanceof Role && $record->is_system) {
                        continue;
                    }
                    $count += $this->normalize($record, $record->getTable(), function (array $values) use ($fields): array {
                        foreach ($fields as $field) {
                            if (array_key_exists($field, $values)) {
                                $values[$field] = UppercaseData::text($values[$field]);
                            }
                        }

                        return $values;
                    });
                }
            });
        }
        $this->info("Normalized {$count} records. Passwords and file contents were preserved.");

        return self::SUCCESS;
    }

    private function normalize(Model $record, string $entity, callable $convert): int
    {
        return DB::transaction(function () use ($record, $entity, $convert): int {
            DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
            $current = $record->newQueryWithoutScopes()->whereKey($record->getKey())->lockForUpdate()->firstOrFail();
            $before = $current->attributesToArray();
            $values = $convert($before);
            foreach ($values as $field => $value) {
                if (($before[$field] ?? null) !== $value) {
                    $current->setAttribute($field, $value);
                }
            }
            if (! $current->isDirty()) {
                return 0;
            }
            $current->version++;
            $current->save();
            Audit::record('uppercase', $entity, $current->getKey(), $before, $current->attributesToArray());

            return 1;
        });
    }
}
