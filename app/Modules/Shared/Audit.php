<?php

namespace App\Modules\Shared;

use App\Models\AuditEvent;
use Illuminate\Support\Facades\Auth;

class Audit
{
    private const PRIVATE_FIELDS = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'path', 'sha256', 'cnic', 'ntn', 'strn', 'account_number', 'iban', 'document_number', 'salary', 'opening_balance', 'address', 'phone', 'mobile', 'email', 'contact_number', 'phone_numbers', 'contact_numbers', 'mobile_numbers', 'comments'];

    public static function record(string $action, string $entity, ?int $recordId, array $before = [], array $after = [], ?int $companyId = null, ?string $label = null, ?int $actorId = null): void
    {
        $changes = [];
        foreach (array_unique([...array_keys($before), ...array_keys($after)]) as $key) {
            if (in_array($key, ['created_at', 'updated_at', 'default_guard'], true) || ($before[$key] ?? null) === ($after[$key] ?? null)) {
                continue;
            }
            $private = in_array($key, self::PRIVATE_FIELDS, true);
            $changes[$key] = ['before' => $private ? '[redacted]' : ($before[$key] ?? null), 'after' => $private ? '[redacted]' : ($after[$key] ?? null)];
        }
        AuditEvent::create(['user_id' => $actorId ?? Auth::id(), 'company_id' => $companyId, 'action' => $action, 'entity' => $entity, 'record_id' => $recordId, 'record_label' => $label, 'changes' => $changes, 'ip_address' => app()->runningInConsole() ? null : request()->ip()]);
    }
}
