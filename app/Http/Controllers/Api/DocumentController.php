<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Modules\Access\Access;
use App\Modules\Shared\Audit;
use App\Modules\Shared\UppercaseData;
use App\Modules\Shared\VisibleRecords;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    public function handle(Request $r, int $person, ?int $id = null): mixed
    {
        Access::authorize($r->user(), 'people', 'view');
        $people = Access::query('people', $r->user());
        if (! $r->isMethod('get') || $r->input('context') !== 'management') {
            VisibleRecords::apply($people, 'people');
        }
        $people->findOrFail($person);
        $action = $r->isMethod('get') ? 'view' : ($r->isMethod('delete') ? 'delete' : ($id ? 'update' : 'create'));
        Access::authorize($r->user(), 'documents', $action);
        if ($r->isMethod('get')) {
            return ['data' => Document::where('person_id', $person)->latest()->get()];
        }
        if ($r->isMethod('delete')) {
            return DB::transaction(function () use ($r, $person, $id) {
                $doc = Document::where('person_id', $person)->lockForUpdate()->findOrFail($id);
                $r->validate(['version' => 'required|integer']);
                abort_if($doc->version !== $r->integer('version'), 409, 'Document changed. Reload before deleting.');
                $before = $doc->toArray();
                $doc->delete();
                Audit::record('delete', 'documents', $doc->id, $before);

                return response()->noContent();
            });
        }
        $r->merge(['document_type' => UppercaseData::text($r->input('document_type')), 'document_number' => UppercaseData::text($r->input('document_number'))]);
        $data = $r->validate(['kind' => ['required', Rule::in(['identification', 'profile', 'signature'])], 'document_type' => 'nullable|string|max:100', 'document_number' => 'nullable|string|max:100', 'expires_on' => 'nullable|date_format:Y-m-d',
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf'], 'version' => $id ? 'required|integer' : 'nullable|integer']);
        $file = $r->file('file');
        $mime = $file->getMimeType();
        $path = 'people/'.$person.'/'.Str::uuid();
        if (str_starts_with($mime, 'image/')) {
            $info = getimagesize($file->getRealPath());
            abort_unless($info && $info[0] * $info[1] <= 16000000, 422, 'Image is too large. Maximum 16 megapixels.');
            $image = imagecreatefromstring(file_get_contents($file->getRealPath()));
            abort_unless($image, 422, 'Invalid image.');
            imagesavealpha($image, true);
            ob_start();
            imagepng($image);
            $contents = ob_get_clean();
            imagedestroy($image);
            $path .= '.png';
            $mime = 'image/png';
        } else {
            abort_unless($data['kind'] === 'identification' && $mime === 'application/pdf', 422, 'Photos and signatures must be JPG, PNG or WebP images.');
            $contents = file_get_contents($file->getRealPath());
            $path .= '.pdf';
        }
        Storage::disk('local')->put($path, $contents);
        try {
            $doc = DB::transaction(function () use ($data, $person, $id, $path, $mime, $contents, $file) {
                DB::table('record_locks')->where('name', 'company_defaults')->lockForUpdate()->first();
                $doc = $id ? Document::where('person_id', $person)->lockForUpdate()->findOrFail($id) : new Document(['person_id' => $person]);
                if ($id) {
                    abort_if($doc->version !== (int) $data['version'], 409, 'Document changed. Reload before replacing.');
                }
                if ($id && $doc->kind !== $data['kind']) {
                    abort(422, 'A replacement must retain the original document kind.');
                }
                if (! $id && $data['kind'] !== 'identification' && Document::where('person_id', $person)->where('kind', $data['kind'])->exists()) {
                    abort(409, 'Replace the existing image instead of adding another.');
                }
                $before = $doc->toArray();
                $doc->fill(collect($data)->only(['kind', 'document_type', 'document_number', 'expires_on'])->all());
                $doc->fill(['path' => $path, 'mime_type' => $mime, 'original_name' => mb_substr(basename($file->getClientOriginalName()), 0, 240), 'size' => strlen($contents), 'sha256' => hash('sha256', $contents), 'version' => $id ? $doc->version + 1 : 1])->save();
                Audit::record($id ? 'replace' : 'upload', 'documents', $doc->id, $before, $doc->toArray());

                return $doc;
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return response()->json(['data' => $doc], $id ? 200 : 201);
    }

    public function download(Request $r, int $person, int $document): mixed
    {
        Access::authorize($r->user(), 'people', 'view');
        Access::authorize($r->user(), 'documents', 'view');
        $people = Access::query('people', $r->user());
        if (! $r->isMethod('get') || $r->input('context') !== 'management') {
            VisibleRecords::apply($people, 'people');
        }
        $people->findOrFail($person);
        $doc = Document::where('person_id', $person)->findOrFail($document);
        abort_unless(Storage::disk('local')->exists($doc->path), 404, 'File is unavailable.');
        $headers = ['Content-Type' => $doc->mime_type, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'];
        if ($r->boolean('inline') && str_starts_with($doc->mime_type, 'image/')) {
            return response()->file(Storage::disk('local')->path($doc->path), $headers);
        }
        Audit::record('download', 'documents', $doc->id);

        return Storage::disk('local')->download($doc->path, $doc->original_name, $headers);
    }
}
