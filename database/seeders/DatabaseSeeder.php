<?php

namespace Database\Seeders;

use App\Models\BusinessType;
use App\Models\EmployeeType;
use App\Models\Permission;
use App\Models\Role;
use App\Modules\Shared\EntityRegistry;
use App\Modules\Shared\UppercaseData;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (EntityRegistry::permissions() as $name) {
            Permission::firstOrCreate(['name' => $name]);
        }
        $super = Role::firstOrCreate(['name' => 'Super Admin'], ['is_system' => true]);
        $admin = Role::firstOrCreate(['name' => 'Admin'], ['is_system' => true]);
        if ($admin->wasRecentlyCreated) {
            $admin->permissions()->sync(Permission::where('name', 'not like', 'roles.%')->where('name', 'not like', 'audit.%')->pluck('id'));
        }
        if (! Role::where('name', 'USER')->exists()) {
            $this->callWith(UserRoleSeeder::class, ['audit' => false]);
        }
        foreach (['Managing Director', 'Shareholders', 'Bank Accounts Manager', 'Customer Accounts Manager', 'Godown Manager', 'Container, Truck & Car Attendant', 'Office Boy', 'Consultant', 'Lawyer', 'Cook'] as $i => $name) {
            EmployeeType::firstOrCreate(['type_number' => $i + 1], ['name' => UppercaseData::text($name), 'code' => 'ET'.($i + 1)]);
        }
        foreach (['Carry', 'Small Sale', 'Vendor', 'Shareholder', 'TP', 'Agent', 'Employee', 'Loan', 'Amanat', 'TT', 'Customer', 'Exporter', 'Consignee', 'Beneficiary', 'Employer'] as $i => $name) {
            BusinessType::firstOrCreate(['code' => 'BUS-'.str_pad((string) ($i + 1), 6, '0', STR_PAD_LEFT)], ['name' => UppercaseData::text($name), 'is_employee' => $name === 'Employee']);
        }
    }
}
