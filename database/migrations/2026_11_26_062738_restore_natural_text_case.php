<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Text is no longer forced to uppercase. Dropdown values move to the options'
 * new spelling, and the standard employee types and business roles get their
 * original spelling back while they still hold the untouched uppercase seed.
 */
return new class extends Migration
{
    /**
     * @var array<string, array{0: string, 1: list<string>}>
     */
    private const OPTIONS = [
        'people' => ['gender', ['Male', 'Female', 'Other', 'Prefer Not to Say']],
        'companies' => ['type', ['Private Limited', 'Public Limited', 'Partnership', 'Sole Proprietorship', 'Other']],
        'person_bank_accounts' => ['account_type', ['Current', 'Savings', 'Foreign Currency', 'Other']],
    ];

    /**
     * @var array<string, list<string>>
     */
    private const SEEDED_NAMES = [
        'employee_types' => ['Managing Director', 'Shareholders', 'Bank Accounts Manager', 'Customer Accounts Manager', 'Godown Manager', 'Container, Truck & Car Attendant', 'Office Boy', 'Consultant', 'Lawyer', 'Cook'],
        'business_types' => ['Carry', 'Small Sale', 'Vendor', 'Shareholder', 'TP', 'Agent', 'Employee', 'Loan', 'Amanat', 'TT', 'Customer', 'Exporter', 'Consignee', 'Beneficiary', 'Employer'],
    ];

    public function up(): void
    {
        foreach (self::OPTIONS as $table => [$column, $options]) {
            foreach ($options as $option) {
                DB::table($table)->whereRaw("UPPER(`{$column}`) = ?", [mb_strtoupper($option)])->update([$column => $option]);
            }
        }
        foreach (self::SEEDED_NAMES as $table => $names) {
            foreach ($names as $name) {
                DB::table($table)->whereRaw('BINARY `name` = ?', [mb_strtoupper($name)])->update(['name' => $name]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::OPTIONS as $table => [$column, $options]) {
            foreach ($options as $option) {
                DB::table($table)->whereRaw('BINARY `'.$column.'` = ?', [$option])->update([$column => mb_strtoupper($option)]);
            }
        }
        foreach (self::SEEDED_NAMES as $table => $names) {
            foreach ($names as $name) {
                DB::table($table)->whereRaw('BINARY `name` = ?', [$name])->update(['name' => mb_strtoupper($name)]);
            }
        }
    }
};
