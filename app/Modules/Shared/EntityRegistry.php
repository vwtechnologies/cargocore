<?php

namespace App\Modules\Shared;

use App\Models;

/** Declarative field contracts shared by validation, API documentation and forms. */
class EntityRegistry
{
    public static function all(): array
    {
        $name = ['label' => 'Name', 'required' => true, 'max' => 255];
        $short = ['label' => 'Short name', 'max' => 50];
        $status = ['label' => 'Status', 'type' => 'boolean', 'default' => true];
        $website = ['label' => 'Website', 'type' => 'url', 'max' => 255];
        $address = ['label' => 'Address', 'type' => 'textarea', 'max' => 5000];
        $phone = ['label' => 'Contact number', 'max' => 50];
        $ref = fn (string $label, string $entity, bool $required = true): array => ['label' => $label, 'type' => 'reference', 'entity' => $entity, 'required' => $required];
        $def = fn (string $label, string $model, string $module, ?string $prefix, array $fields, ?array $parent = null): array => compact('label', 'model', 'module', 'prefix', 'fields', 'parent');

        return [
            'companies' => $def('Companies', Models\Company::class, 'companies', 'COM', [
                'name' => $name, 'short_name' => $short, 'address' => $address, 'contact_number' => $phone, 'fax_number' => ['label' => 'Fax number', 'max' => 50], 'website' => $website, 'status' => $status, 'is_default' => ['label' => 'Default company', 'type' => 'boolean'],
            ]),
            'sub-companies' => $def('Sub-companies', Models\SubCompany::class, 'companies', 'SUB', [
                'code' => ['label' => 'Sub-company code', 'max' => 50, 'unique' => true],
                'name' => $name, 'is_default' => ['label' => 'Default sub-company', 'type' => 'boolean'], 'status' => $status, 'address' => $address, 'website' => $website,
                'contact_numbers' => ['label' => 'Contact numbers', 'type' => 'list'], 'fax_numbers' => ['label' => 'Fax numbers', 'type' => 'list'], 'mobile_numbers' => ['label' => 'Mobile numbers', 'type' => 'list'],
            ], ['entity' => 'companies', 'key' => 'company_id']),
            'countries' => $def('Countries', Models\Country::class, 'geography', 'CTY', [
                'name' => $name + ['unique' => true], 'short_name' => ['label' => 'Short name', 'max' => 20], 'currency' => ['label' => 'Currency', 'max' => 20], 'dial_code' => ['label' => 'Dial code', 'max' => 20], 'display_sequence' => ['label' => 'Display order', 'type' => 'number', 'default' => 1, 'min' => 1], 'status' => $status,
            ]),
            'cities' => $def('Cities', Models\City::class, 'geography', 'CIT', [
                'code' => ['label' => 'City code', 'max' => 50, 'unique' => true, 'immutable' => true], 'name' => $name, 'short_name_1' => ['label' => 'Short name 1', 'max' => 50], 'short_name_2' => ['label' => 'Short name 2', 'max' => 50], 'status' => $status,
            ], ['entity' => 'countries', 'key' => 'country_id']),
            'banks' => $def('Banks', Models\Bank::class, 'banks', 'BNK', [
                'name' => $name, 'short_name' => $short, 'country_id' => $ref('Country', 'countries', false), 'uan' => ['label' => 'UAN', 'max' => 50], 'help_line' => ['label' => 'Help line', 'max' => 50], 'e_bank' => ['label' => 'E-Bank', 'max' => 255], 'website' => $website, 'address' => $address, 'status' => $status,
            ]),
            'branches' => $def('Branches', Models\BankBranch::class, 'banks', 'BRN', [
                'name' => $name, 'country_id' => $ref('Country', 'countries') + ['virtual' => true], 'city_id' => $ref('City', 'cities') + ['depends' => 'country_id'],
                'branch_code' => ['label' => 'Branch code', 'max' => 50], 'nift_code' => ['label' => 'NIFT code', 'max' => 50], 'address' => $address, 'phone_numbers' => ['label' => 'Phone numbers', 'type' => 'list'], 'status' => $status,
            ], ['entity' => 'banks', 'key' => 'bank_id']),
            'officers' => $def('Bank officers', Models\BankOfficer::class, 'banks', null, [
                'person_id' => $ref('Person', 'people'), 'bank_branch_id' => $ref('Branch', 'branches', false), 'designation' => ['label' => 'Officer designation', 'required' => true, 'max' => 255], 'contact_number' => $phone, 'email' => ['label' => 'Email address', 'type' => 'email'], 'status' => $status,
            ], ['entity' => 'banks', 'key' => 'bank_id']),
            'employee-types' => $def('Employee types', Models\EmployeeType::class, 'employee-types', 'EMP', [
                'name' => $name + ['unique' => true], 'status' => $status,
            ]),
            'business-types' => $def('Business roles', Models\BusinessType::class, 'business-types', 'BUS', ['name' => $name + ['unique' => true], 'status' => $status]),
            'markas' => $def('Marka', Models\Marka::class, 'markas', null, [
                'code' => ['label' => 'Marka code', 'required' => true, 'max' => 50, 'unique' => true, 'immutable' => true], 'description' => ['label' => 'Marka description', 'type' => 'textarea', 'required' => true, 'max' => 5000], 'status' => $status,
            ]),
            'people' => $def('People', Models\Person::class, 'people', 'PER', [
                'name' => ['label' => 'Full name', 'required' => true, 'max' => 255], 'father_husband_name' => ['label' => 'Father / husband name', 'max' => 255],
                'cnic' => ['label' => 'CNIC', 'max' => 13, 'unique' => true], 'date_of_birth' => ['label' => 'Date of birth', 'type' => 'date'], 'gender' => ['label' => 'Gender', 'type' => 'combobox', 'options' => ['MALE', 'FEMALE', 'OTHER', 'PREFER NOT TO SAY'], 'max' => 50],
                'ntn' => ['label' => 'NTN', 'max' => 50], 'strn' => ['label' => 'STRN', 'max' => 50], 'city_id' => $ref('Place (city)', 'cities', false), 'joining_date' => ['label' => 'Joining date', 'type' => 'date'], 'place' => ['label' => 'Place', 'max' => 255], 'comments' => ['label' => 'Comments', 'type' => 'textarea', 'max' => 10000], 'status' => $status, 'is_employee' => ['label' => 'Employee', 'type' => 'boolean', 'default' => false],
            ]),
            'contacts' => $def('Contacts', Models\PersonContact::class, 'people', null, [
                'label' => ['label' => 'Label', 'max' => 80], 'address' => $address, 'phone' => ['label' => 'Phone number', 'max' => 50], 'mobile' => ['label' => 'Mobile number', 'max' => 50], 'email' => ['label' => 'Email address', 'type' => 'email'], 'status' => $status,
            ], ['entity' => 'people', 'key' => 'person_id']),
            'person-markas' => $def('Markas', Models\PersonMarka::class, 'markas', null, [
                'marka_id' => $ref('Marka code', 'markas'), 'status' => $status,
            ], ['entity' => 'people', 'key' => 'person_id']),
            'accounts' => $def('Bank accounts', Models\PersonBankAccount::class, 'person-accounts', null, [
                'bank_id' => $ref('Bank', 'banks') + ['virtual' => true], 'country_id' => $ref('Country', 'countries') + ['virtual' => true],
                'city_id' => $ref('City', 'cities') + ['virtual' => true, 'depends' => 'country_id'], 'bank_branch_id' => $ref('Branch', 'branches') + ['depends' => 'city_id'],
                'account_number' => ['label' => 'Account number', 'max' => 100], 'iban' => ['label' => 'IBAN', 'max' => 34], 'account_title' => ['label' => 'Account title', 'required' => true, 'max' => 255], 'status' => $status,
            ], ['entity' => 'people', 'key' => 'person_id']),
            'associations' => $def('Company associations', Models\PersonCompany::class, 'associations', null, [
                'company_id' => $ref('Company', 'companies'), 'status' => $status,
            ], ['entity' => 'people', 'key' => 'person_id']),
            'classifications' => $def('Business role assignments', Models\PersonClassification::class, 'associations', null, [
                'business_type_id' => $ref('Business role', 'business-types'), 'opening_balance' => ['label' => 'Opening amount (PKR)', 'type' => 'money'], 'status' => $status,
            ], ['entity' => 'associations', 'key' => 'person_company_id']),
        ];
    }

    public static function get(string $entity): array
    {
        return self::all()[$entity] ?? abort(404, 'Unknown resource.');
    }

    public static function modules(): array
    {
        return array_unique([...array_column(self::all(), 'module'), 'employee-details', 'documents', 'users', 'roles', 'audit']);
    }

    public static function permissions(): array
    {
        $result = [];
        foreach (self::modules() as $module) {
            foreach ($module === 'audit' ? ['view'] : ['view', 'create', 'update', 'delete'] as $action) {
                $result[] = "$module.$action";
            }
        }

        return $result;
    }
}
