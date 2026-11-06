<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class HealthCheck extends Command
{
    protected $signature = 'erp:health {--require-backup}';

    protected $description = 'Check database, private storage, failed jobs and optional backup freshness';

    public function handle(): int
    {
        $checks = [];
        try {
            DB::select('SELECT 1');
            $checks['database'] = true;
        } catch (\Throwable) {
            $checks['database'] = false;
        }
        $probe = 'health/'.Str::uuid();
        try {
            Storage::disk('local')->put($probe, 'ok');
            $checks['private_storage'] = Storage::disk('local')->get($probe) === 'ok';
            Storage::disk('local')->delete($probe);
        } catch (\Throwable) {
            $checks['private_storage'] = false;
        }
        try {
            $checks['queue'] = DB::table('failed_jobs')->count() === 0;
        } catch (\Throwable) {
            $checks['queue'] = false;
        }
        if ($this->option('require-backup')) {
            $path = storage_path('app/operations/backup.json');
            $state = is_file($path) ? json_decode(ltrim(file_get_contents($path), "\xEF\xBB\xBF"), true) : null;
            $checks['backup'] = ($state['success'] ?? false) && strtotime($state['at'] ?? '') >= time() - 86400;
        }
        $ok = ! in_array(false, $checks, true);
        $this->line(json_encode(['healthy' => $ok, 'checks' => $checks]));

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
