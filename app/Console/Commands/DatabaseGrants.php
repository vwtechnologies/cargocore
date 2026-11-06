<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class DatabaseGrants extends Command
{
    protected $signature = 'erp:database-grants {--user=cargocore_app} {--host=127.0.0.1}';

    protected $description = 'Print per-table runtime grants, keeping audit_events append-only (apply with a DBA account)';

    public function handle(): int
    {
        $database = config('database.connections.'.config('database.default').'.database');
        $user = $this->option('user');
        $host = $this->option('host');
        foreach ([$database, $user, $host] as $value) {
            if (! preg_match('/^[a-zA-Z0-9_.-]+$/', $value)) {
                $this->error('Invalid identifier.');

                return self::FAILURE;
            }
        }
        $this->line("REVOKE ALL PRIVILEGES ON `$database`.* FROM '$user'@'$host';");
        foreach (Schema::getTableListing() as $table) {
            $table = basename(str_replace('.', '/', $table));
            if (! preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                continue;
            }
            $privileges = match ($table) {
                'audit_events' => 'SELECT, INSERT','migrations' => 'SELECT',default => 'SELECT, INSERT, UPDATE, DELETE'
            };
            $this->line("GRANT $privileges ON `$database`.`$table` TO '$user'@'$host';");
        }

        return self::SUCCESS;
    }
}
