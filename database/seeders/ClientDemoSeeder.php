<?php

namespace Database\Seeders;

use App\Models\AuditEvent;
use App\Models\Bank;
use App\Models\BankBranch;
use App\Models\BankOfficer;
use App\Models\BusinessType;
use App\Models\City;
use App\Models\Company;
use App\Models\Country;
use App\Models\EmployeeProfile;
use App\Models\EmployeeType;
use App\Models\Marka;
use App\Models\Permission;
use App\Models\Person;
use App\Models\PersonBankAccount;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\PersonContact;
use App\Models\PersonMarka;
use App\Models\Role;
use App\Models\SubCompany;
use App\Models\User;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

class ClientDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('Build the client demo in an isolated local/testing database, then import its SQL export.');
        }
        if (User::exists() || Person::exists() || Company::exists() || Country::exists() || Bank::exists()) {
            throw new RuntimeException('Client demo seeding requires an empty business database. Existing records were not changed.');
        }
        $passwords = Validator::make([
            'admin_password' => config('demo.admin_password'),
            'super_password' => config('demo.super_password'),
        ], [
            'admin_password' => ['required', 'string', Password::min(12)->letters()->numbers()],
            'super_password' => ['required', 'string', Password::min(12)->letters()->numbers()],
        ])->validate();
        $profiles = json_decode(File::get(config('demo.role_profiles')), true, flags: JSON_THROW_ON_ERROR);
        Validator::make(['profiles' => $profiles], [
            'profiles' => ['required', 'array', 'min:1'],
            'profiles.*.name' => ['required', 'string', 'distinct'],
            'profiles.*.status' => ['required', 'boolean'],
            'profiles.*.is_system' => ['required', 'boolean'],
            'profiles.*.permissions' => ['present', 'array'],
            'profiles.*.permissions.*' => ['string', Rule::in(EntityRegistry::permissions())],
        ])->validate();

        DB::transaction(function () use ($passwords, $profiles): void {
            $this->call(DatabaseSeeder::class);
            foreach ($profiles as $profile) {
                $role = Role::updateOrCreate(['name' => $profile['name']], ['status' => $profile['status'], 'is_system' => $profile['is_system']]);
                $permissions = $profile['name'] === 'Super Admin' ? EntityRegistry::permissions() : $profile['permissions'];
                if ($profile['name'] === 'Admin') {
                    $permissions = array_values(array_filter($permissions, fn (string $permission): bool => ! str_starts_with($permission, 'audit.') && ! str_starts_with($permission, 'roles.')));
                }
                $role->permissions()->sync(Permission::whereIn('name', $permissions)->pluck('id'));
            }
            Role::where('name', 'Super Admin')->firstOrFail()->permissions()->sync(Permission::pluck('id'));
            Role::where('name', 'Admin')->firstOrFail()->permissions()->detach(Permission::where(fn (Builder $query): Builder => $query->where('name', 'like', 'audit.%')->orWhere('name', 'like', 'roles.%'))->pluck('id'));

            $pakistan = Country::create(['code' => 'CTY-DEMO-PK', 'name' => 'PAKISTAN', 'short_name' => 'PK', 'currency' => 'PKR', 'dial_code' => '+92', 'display_sequence' => 1]);
            $emirates = Country::create(['code' => 'CTY-DEMO-AE', 'name' => 'UNITED ARAB EMIRATES', 'short_name' => 'AE', 'currency' => 'AED', 'dial_code' => '+971', 'display_sequence' => 2]);
            $china = Country::create(['code' => 'CTY-DEMO-CN', 'name' => 'CHINA', 'short_name' => 'CN', 'currency' => 'CNY', 'dial_code' => '+86', 'display_sequence' => 3, 'status' => false]);
            $cities = [];
            foreach ([['RAWALPINDI', 'RWP', $pakistan, true], ['ISLAMABAD', 'ISB', $pakistan, true], ['KARACHI', 'KHI', $pakistan, true], ['LAHORE', 'LHE', $pakistan, false], ['DUBAI', 'DXB', $emirates, true], ['BEIJING', 'BJS', $china, false]] as $index => [$name, $short, $country, $active]) {
                $cities[] = City::create(['code' => 'CIT-CLIENT-'.($index + 1), 'name' => $name, 'short_name_1' => $short, 'country_id' => $country->id, 'status' => $active]);
            }
            $companies = [];
            foreach ([['CARGOCORE LOGISTICS (PVT) LTD', 'CCL', true], ['UNITED TRADE EXPRESS', 'UTE', true], ['SKYLINK CARGO SERVICES', 'SKY', true], ['ARCHIVED FREIGHT COMPANY', 'AFC', false]] as $index => [$name, $short, $active]) {
                $company = Company::create(['code' => $short, 'name' => $name, 'short_name' => $short, 'is_default' => $index === 0, 'status' => $active, 'address' => 'DEMO BUSINESS DISTRICT, '.$cities[$index % 3]->name, 'contact_number' => '+92 51 555'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT), 'website' => 'HTTPS://EXAMPLE.TEST']);
                $companies[] = $company;
                SubCompany::create(['code' => 'SUB-CLIENT-'.($index + 1), 'company_id' => $company->id, 'name' => $short.' MAIN OFFICE', 'is_default' => true, 'status' => $active, 'address' => $company->address, 'contact_numbers' => [$company->contact_number]]);
            }
            $branches = [];
            $banks = [];
            foreach ([['NATIONAL BANK OF PAKISTAN', 'NBP', true], ['HABIB BANK LIMITED', 'HBL', true], ['ARCHIVED DEMO BANK', 'ADB', false]] as $index => [$name, $short, $active]) {
                $bank = Bank::create(['code' => 'BNK-CLIENT-'.($index + 1), 'name' => $name, 'short_name' => $short, 'country_id' => $pakistan->id, 'status' => $active, 'uan' => '111-000-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT), 'website' => 'HTTPS://EXAMPLE.TEST']);
                $banks[] = $bank;
                foreach (array_slice($cities, 0, 2) as $cityIndex => $city) {
                    $branches[] = BankBranch::create(['code' => 'BRN-CLIENT-'.$index.'-'.$cityIndex, 'bank_id' => $bank->id, 'city_id' => $city->id, 'name' => $city->name.' MAIN BRANCH', 'branch_code' => str_pad((string) ($index * 100 + $cityIndex + 1), 4, '0', STR_PAD_LEFT), 'nift_code' => str_pad((string) ($index * 10 + $cityIndex + 1), 5, '0', STR_PAD_LEFT), 'address' => 'DEMO COMMERCIAL AREA, '.$city->name, 'phone_numbers' => ['+92 51 5550100'], 'status' => $active]);
                }
            }
            $people = [];
            foreach ([['ALI', true, true], ['SARA KHAN', true, false], ['USMAN AHMED', true, true], ['AYESHA MALIK', true, false], ['BILAL TRADERS', true, false], ['INACTIVE DEMO CUSTOMER', false, false]] as $index => [$name, $active, $employee]) {
                $city = $cities[$index % 3];
                $person = Person::create(['code' => 'PER-CLIENT-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT), 'name' => $name, 'father_husband_name' => 'DEMO FAMILY NAME', 'cnic' => '999990000000'.($index + 1), 'date_of_birth' => '1990-01-'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT), 'gender' => in_array($index, [1, 3], true) ? 'Female' : 'Male', 'ntn' => 'DEMO-NTN-'.($index + 1), 'strn' => 'DEMO-STRN-'.($index + 1), 'city_id' => $city->id, 'place' => $city->name, 'is_employee' => $employee, 'joining_date' => $employee ? '2026-01-01' : null, 'status' => $active, 'comments' => 'SYNTHETIC CLIENT DEMO DATA; NO REAL PERSONAL OR BANKING INFORMATION.']);
                $people[] = $person;
                PersonContact::create(['person_id' => $person->id, 'phone' => '+92 51 555'.str_pad((string) ($index + 101), 4, '0', STR_PAD_LEFT), 'mobile' => '+92 300 000'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT), 'email' => 'DEMO'.($index + 1).'@EXAMPLE.TEST', 'address' => 'DEMO STREET '.($index + 1).', '.$city->name, 'status' => $active]);
                $association = PersonCompany::create(['person_id' => $person->id, 'company_id' => $companies[$index % 3]->id, 'status' => $active]);
                $businessRole = BusinessType::where('name', $employee ? 'EMPLOYEE' : ($index === 4 ? 'VENDOR' : 'CUSTOMER'))->firstOrFail();
                PersonClassification::create(['person_company_id' => $association->id, 'business_type_id' => $businessRole->id, 'opening_balance' => $index % 2 ? '-15000.00' : '25000.00', 'status' => $active]);
                PersonBankAccount::create(['person_id' => $person->id, 'bank_branch_id' => $branches[$index % 4]->id, 'account_title' => $person->name, 'account_number' => '000000001000'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT), 'iban' => null, 'status' => $active]);
                if ($employee) {
                    $profile = EmployeeProfile::create(['person_id' => $person->id, 'salary' => $index === 0 ? '125000.00' : '75000.00']);
                    $profile->types()->sync(EmployeeType::whereIn('type_number', $index === 0 ? [1, 2] : [3])->pluck('id'));
                }
            }
            $extraAssociation = PersonCompany::create(['person_id' => $people[0]->id, 'company_id' => $companies[1]->id]);
            PersonClassification::create(['person_company_id' => $extraAssociation->id, 'business_type_id' => BusinessType::where('name', 'SHAREHOLDER')->firstOrFail()->id, 'opening_balance' => '100000.00']);
            BankOfficer::create(['bank_id' => $banks[0]->id, 'bank_branch_id' => $branches[0]->id, 'person_id' => $people[1]->id, 'designation' => 'RELATIONSHIP MANAGER', 'contact_number' => '+92 51 5550199', 'email' => 'BANK.OFFICER@EXAMPLE.TEST']);
            foreach ([['DEMO-A', 'GENERAL CARGO', true], ['DEMO-B', 'FRAGILE GOODS', true], ['DEMO-OLD', 'INACTIVE LABEL', false]] as [$code, $description, $active]) {
                $marka = Marka::create(['code' => $code, 'description' => $description, 'status' => $active]);
                if ($active) {
                    PersonMarka::create(['person_id' => $people[0]->id, 'marka_id' => $marka->id]);
                }
            }
            EmployeeType::where('type_number', 10)->update(['status' => false]);
            BusinessType::where('name', 'CONSIGNEE')->update(['status' => false]);
            $ali = User::create(['name' => 'ALI', 'username' => 'ALI', 'password' => $passwords['admin_password'], 'role_id' => Role::where('name', 'Admin')->firstOrFail()->id, 'person_id' => $people[0]->id, 'status' => true, 'must_change_password' => false]);
            $ali->companies()->sync([$companies[0]->id, $companies[1]->id]);
            $saath = User::create(['name' => 'SAATH', 'username' => 'SAATH', 'password' => $passwords['super_password'], 'role_id' => Role::where('name', 'Super Admin')->firstOrFail()->id, 'person_id' => null, 'status' => true, 'must_change_password' => false]);
            $saath->companies()->sync(array_map(fn (Company $company): int => $company->id, array_slice($companies, 0, 3)));
            foreach ($companies as $company) {
                AuditEvent::create(['user_id' => $saath->id, 'company_id' => $company->id, 'action' => 'create', 'entity' => 'companies', 'record_id' => $company->id, 'record_label' => $company->name, 'changes' => ['after' => ['name' => $company->name, 'status' => $company->status]]]);
            }
        });
    }
}
