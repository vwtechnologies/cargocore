<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Person;
use Illuminate\Support\Facades\Storage;
use Tests\ErpTestCase;

class RecoveryIntegrityTest extends ErpTestCase
{
    public function test_recovery_verification_detects_corruption_and_missing_files(): void
    {
        Storage::fake('local');
        $person = Person::factory()->create();
        $bytes = 'Recovered document bytes';
        $path = 'people/'.$person->id.'/recovery.pdf';
        Storage::disk('local')->put($path, $bytes);
        Document::create(['person_id' => $person->id, 'kind' => 'identification', 'document_type' => 'Test', 'path' => $path, 'original_name' => 'recovery.pdf', 'mime_type' => 'application/pdf', 'size' => strlen($bytes), 'sha256' => hash('sha256', $bytes)]);
        $this->artisan('erp:verify-files')->assertSuccessful();
        Storage::disk('local')->put($path, 'Corrupted recovery');
        $this->artisan('erp:verify-files')->assertFailed();
        Storage::disk('local')->delete($path);
        $this->artisan('erp:verify-files')->assertFailed();
        Storage::disk('local')->put($path, $bytes);
        $this->artisan('erp:verify-files')->assertSuccessful();
    }
}
