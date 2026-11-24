<?php

namespace App\Modules\Shared;

use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\BankOfficer;
use App\Models\City;
use App\Models\Company;
use App\Models\CompanyAddress;
use App\Models\CompanyOwner;
use App\Models\Person;
use App\Models\PersonBankAccount;
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
        if ($entity === 'companies' && ! empty($data['parent_company_id'])) {
            $ancestor = (int) $data['parent_company_id'];
            $visited = $record ? [$record->id] : [];
            while ($ancestor) {
                if (in_array($ancestor, $visited, true)) {
                    self::fail('parent_company_id', 'A company cannot be its own parent or a descendant of itself.');
                }
                $visited[] = $ancestor;
                $ancestor = (int) DB::table('companies')->where('id', $ancestor)->value('parent_company_id');
            }
        }
        if (in_array($entity, ['company-contacts', 'company-emails', 'company-addresses', 'branch-contacts'], true)) {
            $active = (bool) ($data['status'] ?? $record?->status ?? true);
            if (! $active) {
                if ($data['is_primary'] ?? false) {
                    self::fail('is_primary', 'A primary record must be active.');
                }
                $data['is_primary'] = false;
            }
            if ($data['is_primary'] ?? false) {
                $definition = EntityRegistry::get($entity);
                $model = $definition['model'];
                $parentKey = $definition['parent']['key'];
                foreach ($model::where($parentKey, $data[$parentKey])->where('is_primary', true)->where('id', '!=', $record?->id ?? 0)->lockForUpdate()->get() as $old) {
                    $before = $old->toArray();
                    $old->is_primary = false;
                    $old->version++;
                    $old->save();
                    Audit::record('update', $entity, $old->id, $before, $old->toArray(), $old->company_id);
                }
            }
        }
        if ($entity === 'company-addresses') {
            $country = array_key_exists('country_id', $data) ? $data['country_id'] : $record?->country_id;
            if (! $country && (! $record || $record->country_id)) {
                self::fail('country_id', 'Select a country for this address.');
            }
            $city = array_key_exists('city_id', $data) ? $data['city_id'] : $record?->city_id;
            if ($city && (! $country || (int) City::findOrFail($city)->country_id !== (int) $country)) {
                self::fail('city_id', 'Select a city in the address country.');
            }
        }
        if ($entity === 'company-owners') {
            $personId = array_key_exists('person_id', $data) ? $data['person_id'] : $record?->person_id;
            if ($personId) {
                $person = Person::findOrFail($personId);
                $data['name'] = $person->name;
                $data['cnic'] = $person->cnic;
                if (CompanyOwner::where('company_id', $data['company_id'])->where('person_id', $person->id)->where('id', '!=', $record?->id ?? 0)->exists()) {
                    self::fail('person_id', 'This person is already linked to the company.');
                }
            } elseif (empty($data['name'] ?? $record?->name)) {
                self::fail('name', 'Select a Person or enter a name.');
            }
            $percentage = array_key_exists('ownership_percentage', $data) ? $data['ownership_percentage'] : $record?->ownership_percentage;
            if ($percentage !== null && ((float) $percentage < 0 || (float) $percentage > 100)) {
                self::fail('ownership_percentage', 'Ownership must be between 0 and 100.');
            }
            $total = CompanyOwner::where('company_id', $data['company_id'])->where('status', true)->where('id', '!=', $record?->id ?? 0)->sum('ownership_percentage');
            if (($data['status'] ?? $record?->status ?? true) && (int) round((float) $total * 100) + (int) round((float) $percentage * 100) > 10000) {
                self::fail('ownership_percentage', 'Total active ownership cannot exceed 100%.');
            }
        }
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
        if ($entity === 'accounts' || $entity === 'bank-accounts') {
            $value = fn (string $key): mixed => array_key_exists($key, $data) ? $data[$key] : $record?->getAttribute($key);
            if ($value('is_our_account') && ! $value('company_id')) {
                self::fail('company_id', 'Select which of our companies holds this account.');
            }
            if ($value('is_employee') && ! $value('person_id')) {
                self::fail('person_id', 'Link the employee this account belongs to.');
            }
            if (! empty($data['person_id']) && ((int) $data['person_id'] !== (int) $record?->person_id || (empty($data['account_holder_name']) && empty($data['account_holder_cnic'])))) {
                $person = Person::findOrFail($data['person_id']);
                $data['account_holder_name'] = ($data['account_holder_name'] ?? null) ?: $person->name;
                $data['account_holder_cnic'] = ($data['account_holder_cnic'] ?? null) ?: $person->cnic;
            }
            $addressId = array_key_exists('company_address_id', $data) ? $data['company_address_id'] : $record?->company_address_id;
            $companyId = array_key_exists('company_id', $data) ? $data['company_id'] : $record?->company_id;
            if ($addressId) {
                $address = CompanyAddress::findOrFail($addressId);
                if (! $companyId || (int) $address->company_id !== (int) $companyId) {
                    self::fail('company_address_id', 'Select an address belonging to the legal account company.');
                }
            }
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
            $duplicate = PersonBankAccount::query()->whereKeyNot($record?->id ?? 0)->where(function ($query) use ($data) {
                if (! empty($data['iban'])) {
                    $query->orWhere('iban', $data['iban']);
                }
                if (! empty($data['account_number'])) {
                    $query->orWhere(fn ($same) => $same->where('bank_branch_id', $data['bank_branch_id'])->where('account_number', $data['account_number']));
                }
            })->first();
            if ($duplicate) {
                self::fail(! empty($data['iban']) && $duplicate->iban === $data['iban'] ? 'iban' : 'account_number', 'This bank account already exists ('.$duplicate->account_title.'). Open it in Bank Accounts and add the category there instead of creating a duplicate.');
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
            'companies' => [['companies', 'parent_company_id'], ['company_contacts', 'company_id'], ['company_emails', 'company_id'], ['company_addresses', 'company_id'], ['company_owners', 'company_id'], ['person_bank_accounts', 'company_id'], ['sub_companies', 'company_id'], ['person_companies', 'company_id'], ['company_user', 'company_id']],
            'company-addresses' => [['person_bank_accounts', 'company_address_id']],
            'countries' => [['cities', 'country_id'], ['company_addresses', 'country_id']], 'cities' => [['company_addresses', 'city_id'], ['bank_branches', 'city_id'], ['people', 'city_id']],
            'banks' => [['bank_branches', 'bank_id'], ['bank_officers', 'bank_id']],
            'branches' => [['bank_officers', 'bank_branch_id'], ['person_bank_accounts', 'bank_branch_id'], ['bank_branch_contacts', 'bank_branch_id']],
            'people' => [['company_owners', 'person_id'], ['person_contacts', 'person_id'], ['person_bank_accounts', 'person_id'], ['person_companies', 'person_id'], ['person_markas', 'person_id'], ['employee_profiles', 'person_id'], ['bank_officers', 'person_id'], ['documents', 'person_id'], ['users', 'person_id']],
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
