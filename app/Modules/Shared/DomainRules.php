<?php

namespace App\Modules\Shared;

use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\BankOfficer;
use App\Models\City;
use App\Models\Company;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\PersonMarka;
use App\Models\Record;
use App\Models\SubCompany;
use App\Models\User;
use App\Modules\Access\Access;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DomainRules
{
    public static function fail(string $key, string $message): never
    {
        throw ValidationException::withMessages([$key => $message]);
    }

    public static function check(string $entity, array &$data, ?Record $record, User $user): void
    {
        if ($entity === 'employee-types') {
            if (empty($data['type_number']) && ! $record?->type_number) {
                $data['type_number'] = ((int) DB::table('employee_types')->max('type_number')) + 1;
            }
        }
        if ($entity === 'companies' || $entity === 'sub-companies') {
            if (($data['is_default'] ?? false) && ! ($data['status'] ?? true)) {
                self::fail('is_default', 'A default record must be active.');
            }
            if ($record?->is_default && (! ($data['status'] ?? $record->status) || (array_key_exists('is_default', $data) && ! $data['is_default']))) {
                self::fail('is_default', 'Select another active default before changing this record.');
            }
            if ($entity === 'companies' && ! Company::exists()) {
                $data['is_default'] = true;
                if (! ($data['status'] ?? true)) {
                    self::fail('status', 'The first company must be active.');
                }
            }
            if ($data['is_default'] ?? false) {
                $query = $entity === 'companies' ? Company::query() : SubCompany::where('company_id', $data['company_id']);
                foreach ($query->where('is_default', true)->where('id', '!=', $record?->id ?? 0)->lockForUpdate()->get() as $old) {
                    if ($entity === 'companies') {
                        Access::company($user, $old->id);
                    }
                    $before = $old->toArray();
                    $old->is_default = false;
                    $old->version++;
                    $old->save();
                    Audit::record('update', $entity, $old->id, $before, $old->toArray(), $entity === 'companies' ? $old->id : $old->company_id, $old->name);
                }
            }
        }
        if ($entity === 'branches') {
            $bank = Bank::find($data['bank_id'] ?? null);
            if ($bank?->country_id && (int) City::findOrFail($data['city_id'])->country_id !== (int) $bank->country_id) {
                self::fail('city_id', 'Select a city in the bank country.');
            }
            $countryId = $data['country_id'] ?? $bank?->country_id;
            if ($countryId && (int) City::findOrFail($data['city_id'])->country_id !== (int) $countryId) {
                self::fail('city_id', 'Select a city in the selected country.');
            }
        }
        if ($entity === 'accounts') {
            $branch = BankBranch::with('city')->findOrFail($data['bank_branch_id']);
            if ((int) $branch->bank_id !== (int) $data['bank_id'] || (int) $branch->city_id !== (int) $data['city_id'] || (int) $branch->city->country_id !== (int) $data['country_id']) {
                self::fail('bank_branch_id', 'Bank, country, city and branch must match.');
            }
            if (empty($data['account_number']) && empty($data['iban'])) {
                self::fail('account_number', 'Enter an account number or IBAN.');
            }
            if (! empty($data['iban'])) {
                $iban = strtoupper(preg_replace('/\s+/', '', $data['iban']));
                if (! preg_match('/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/', $iban)) {
                    self::fail('iban', 'Enter a valid IBAN.');
                }
                $rearranged = substr($iban, 4).substr($iban, 0, 4);
                $digits = '';
                foreach (str_split($rearranged) as $char) {
                    $digits .= ctype_alpha($char) ? (string) (ord($char) - 55) : $char;
                }
                $remainder = 0;
                foreach (str_split($digits) as $digit) {
                    $remainder = ($remainder * 10 + (int) $digit) % 97;
                }
                if ($remainder !== 1) {
                    self::fail('iban', 'The IBAN checksum is invalid.');
                } $data['iban'] = $iban;
            }
        }
        if ($entity === 'officers') {
            if (! empty($data['bank_branch_id']) && (int) BankBranch::findOrFail($data['bank_branch_id'])->bank_id !== (int) $data['bank_id']) {
                self::fail('bank_branch_id', 'This branch belongs to another bank.');
            }
            if (BankOfficer::withTrashed()->where('bank_id', $data['bank_id'])->where('person_id', $data['person_id'])->where('bank_branch_id', $data['bank_branch_id'] ?? null)->where('id', '!=', $record?->id ?? 0)->exists()) {
                self::fail('person_id', 'This officer is already assigned here.');
            }
        }
        if ($entity === 'contacts' && ! array_filter(array_intersect_key($data, array_flip(['address', 'phone', 'mobile', 'email'])))) {
            self::fail('address', 'Enter at least one address, phone, mobile or email.');
        }
        if ($entity === 'person-markas' && PersonMarka::where('person_id', $data['person_id'])->where('marka_id', $data['marka_id'])->where('id', '!=', $record?->id ?? 0)->exists()) {
            self::fail('marka_id', 'This Marka is already linked to this person.');
        }
        if ($entity === 'associations') {
            Access::company($user, (int) $data['company_id']);
            if (PersonCompany::withTrashed()->where('person_id', $data['person_id'])->where('company_id', $data['company_id'])->where('id', '!=', $record?->id ?? 0)->exists()) {
                self::fail('company_id', 'This person already has an association with this company.');
            }
            if ($record && (int) $record->company_id !== (int) $data['company_id']) {
                self::fail('company_id', 'Create another association to use a different company.');
            }
        }
        if ($entity === 'classifications') {
            $association = PersonCompany::findOrFail($data['person_company_id']);
            Access::company($user, $association->company_id);
            if (PersonClassification::withTrashed()->where('person_company_id', $data['person_company_id'])->where('business_type_id', $data['business_type_id'])->where('id', '!=', $record?->id ?? 0)->exists()) {
                self::fail('business_type_id', 'This business role already exists for this association.');
            }
        }
    }

    public static function assertDeletable(string $entity, Record $record): void
    {
        if ($record->getAttribute('is_default')) {
            self::fail('record', 'Select a replacement default before deleting this record.');
        }
        $references = [
            'companies' => [['sub_companies', 'company_id'], ['person_companies', 'company_id'], ['company_user', 'company_id']],
            'countries' => [['cities', 'country_id']], 'cities' => [['bank_branches', 'city_id'], ['people', 'city_id']],
            'banks' => [['bank_branches', 'bank_id'], ['bank_officers', 'bank_id']],
            'branches' => [['bank_officers', 'bank_branch_id'], ['person_bank_accounts', 'bank_branch_id']],
            'people' => [['person_contacts', 'person_id'], ['person_bank_accounts', 'person_id'], ['person_companies', 'person_id'], ['person_markas', 'person_id'], ['employee_profiles', 'person_id'], ['bank_officers', 'person_id'], ['documents', 'person_id'], ['users', 'person_id']],
            'markas' => [['person_markas', 'marka_id']],
            'associations' => [['person_classifications', 'person_company_id']],
            'employee-types' => [['employee_profile_type', 'employee_type_id']], 'business-types' => [['person_classifications', 'business_type_id']],
        ];
        if ($entity === 'business-types' && $record->is_employee) {
            self::fail('record', 'The Employee business role is a system reference. Deactivate it instead.');
        }
        foreach ($references[$entity] ?? [] as [$table,$key]) {
            if (DB::table($table)->where($key, $record->id)->exists()) {
                self::fail('record', 'This record is referenced. Deactivate it to preserve its history.');
            }
        }
    }
}
