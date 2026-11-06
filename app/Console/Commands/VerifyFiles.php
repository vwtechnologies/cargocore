<?php

namespace App\Console\Commands;

use App\Models\Document;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class VerifyFiles extends Command
{
    protected $signature = 'erp:verify-files';

    protected $description = 'Verify every current private document exists and matches its stored SHA-256 after recovery';

    public function handle(): int
    {
        $checked = 0;
        $failed = 0;
        foreach (Document::cursor() as $document) {
            $checked++;
            $path = Storage::disk('local')->path($document->path);
            if (! is_file($path) || ! hash_equals($document->sha256, hash_file('sha256', $path))) {
                $failed++;
                $this->error('Document '.$document->id.' is missing or has an integrity mismatch.');
            }
        }
        $this->line(json_encode(['checked' => $checked, 'failed' => $failed]));

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
