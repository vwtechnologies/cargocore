<?php

namespace Database\Seeders;

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
use App\Models\Person;
use App\Models\PersonClassification;
use App\Models\PersonCompany;
use App\Models\PersonContact;
use App\Models\SubCompany;
use App\Modules\Shared\Audit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Demo data is restricted to local and testing environments.');
        }
        DB::transaction(function () {
            $this->call(DatabaseSeeder::class);
            $countries = [];
            $countryDefs = [
                'Pakistan' => ['short' => 'PK', 'currency' => 'PKR', 'dial_code' => '+92'],
                'China' => ['short' => 'CN', 'currency' => 'CNY', 'dial_code' => '+86'],
            ];
            foreach ($countryDefs as $name => $meta) {
                $countries[$meta['short']] = Country::firstOrCreate(
                    ['name' => $name],
                    [
                        'code' => 'CTY-'.$meta['short'],
                        'short_name' => $meta['short'],
                        'currency' => $meta['currency'],
                        'dial_code' => $meta['dial_code'],
                        'display_sequence' => (int) Country::max('display_sequence') + 1,
                    ]
                );
            }
            $cities = [];
            $cityDefs = [
                ['code' => 'CIT-DEMO-1', 'name' => 'Rawalpindi', 'short' => null],
                ['code' => 'CIT-DEMO-2', 'name' => 'Islamabad', 'short' => 'ISB'],
                ['code' => 'CIT-DEMO-3', 'name' => 'Karachi', 'short' => 'KHI'],
                ['code' => 'CIT-DEMO-4', 'name' => 'Lahore', 'short' => 'LHE'],
                ['code' => 'CIT-DEMO-5', 'name' => 'Sost', 'short' => 'SOST'],
            ];
            foreach ($cityDefs as $c) {
                $cities[] = City::updateOrCreate(
                    ['code' => $c['code']],
                    ['name' => $c['name'], 'short_name_1' => $c['short'], 'country_id' => $countries['PK']->id]
                );
            }
            $companyDefs = [
                ['United Trade Express', 'UTE', 'Business District, Rawalpindi', '+92 51 5551 212', '4211-869', 'https://unitedtrade.pk'],
                ['Karakoram Logistics', 'KL', 'Sector I-9/2 Industrial Area, Islamabad', '+92 51 4433 881', '7102-334', 'https://karakoramlogistics.pk'],
                ['Northern Gateway Trading', 'NGT', 'Plot 14, West Wharf Road, Karachi', '+92 21 3285 4400', '5819-220', 'https://northerngateway.pk'],
                ['CargoCore Global Freight (Pvt) Ltd', 'CCG', 'Cargo Village, Jinnah International Airport, Karachi', '+92 21 3456 7788', '8392-110', 'https://cargocore.pk'],
                ['SkyLink Cargo & Transit LLC', 'SKF', 'Suite 402, Al Maktoum Cargo Terminal, Dubai', '+971 4 282 1100', '9812-445', 'https://skylinkfreight.ae'],
                ['Harbor Line Ocean Shipping', 'HLS', 'Terminal 2, Port Muhammad Bin Qasim, Karachi', '+92 21 3472 0019', '3112-984', 'https://harborlineship.com'],
                ['Silk Road Express Transit', 'SRE', 'Main Karakoram Highway, Border Terminal, Sost', '+92 58 1345 678', '1102-554', 'https://silkroadexpress.pk'],
                ['Indus Valley Logistics Hub', 'IVL', 'Multan Road Dry Port Terminal, Lahore', '+92 42 3751 2288', '5221-789', 'https://indusvalleylogistics.com'],
                ['Crescent Maritime Agencies', 'CMA', 'Ocean Centre, I.I. Chundrigar Road, Karachi', '+92 21 3241 8899', '7341-209', 'https://crescentmaritime.pk'],
                ['Apex Intermodal Cargo Movers', 'AIC', 'Freight Corridor Terminal, Sector I-10, Islamabad', '+92 51 5591 4400', '6192-331', 'https://apexcargo.pk'],
                ['Khyber Overland Freightways', 'KOF', 'Ring Road Custom Logistics Park, Peshawar', '+92 91 5842 110', '8201-447', 'https://khyberoverland.pk'],
                ['Orient Clearing & Forwarding Ltd', 'OCF', 'Mall Road Commercial Complex, Lahore', '+92 42 3628 9911', '4921-663', 'https://orientforwarding.pk'],
                ['Falcon Air & Sea Logistics', 'FAS', 'Gulberg III Industrial Area, Lahore', '+92 42 3578 4455', '3482-119', 'https://falconlogistics.pk'],
                ['Bolan Trans-Provincial Haulage', 'BTH', 'Dry Port Complex, Bypass Road, Quetta', '+92 81 2831 220', '9142-778', 'https://bolanhaulage.pk'],
                ['Crown Shipping & Stevedoring', 'CSS', 'Marine Drive, Block 4 Clifton, Karachi', '+92 21 3587 6622', '2291-550', 'https://crownshipping.pk'],
                ['Trans-Arabia Logistics Network', 'TAL', 'Jebel Ali Free Zone, South Gate 4, Dubai', '+971 4 881 2299', '7712-401', 'https://transarabialogistics.com'],
                ['Baltistan Mountain Freight Line', 'BMF', 'Karakoram Highway Commercial Depot, Gilgit', '+92 58 1145 330', '5512-882', 'https://baltistanfreight.pk'],
                ['Gwadar Deepwater Port Terminal', 'GDP', 'East Bay Expressway Logistics Zone, Gwadar', '+92 86 4210 990', '4410-239', 'https://gwadarterminal.pk'],
                ['Mehran Express Cargo Services', 'MEC', 'SITE Industrial Estate, Kotri Road, Hyderabad', '+92 22 3881 445', '8123-667', 'https://mehrancargo.pk'],
                ['Punjab Cold Chain Logistics', 'PCC', 'Kot Lakhpat Industrial Area, Ferozepur Road, Lahore', '+92 42 3591 0022', '6321-998', 'https://punjabcoldchain.pk'],
                ['Saffron Air Cargo Charter', 'SAC', 'Cargo Complex, Bacha Khan International Airport, Peshawar', '+92 91 5253 440', '1982-334', 'https://saffronaircargo.pk'],
                ['Chenab Interprovincial Carriers', 'CIC', 'Sargodha Road Dry Port, Faisalabad', '+92 41 8781 229', '7732-551', 'https://chenabcarriers.pk'],
                ['Potohar Bonded Warehousing Ltd', 'PBW', 'Chaklala Scheme III Commercial Area, Rawalpindi', '+92 51 5599 110', '3819-445', 'https://potoharwarehousing.pk'],
                ['Zulfiqar Maritime Stevedores', 'ZMS', 'East Wharf, Keamari Port, Karachi', '+92 21 3285 1199', '9021-338', 'https://zulfiqarmaritime.pk'],
            ];

            $companies = [];
            foreach ($companyDefs as $i => [$name, $short, $address, $phone, $fax, $website]) {
                $companies[] = Company::firstOrCreate(
                    ['code' => 'COM-DEMO-'.($i + 1)],
                    [
                        'name' => $name,
                        'short_name' => $short,
                        'address' => $address,
                        'contact_number' => $phone,
                        'fax_number' => $fax,
                        'website' => $website,
                        'is_default' => ! Company::where('is_default', true)->exists(),
                    ]
                );
            }

            $subCompanyDefs = [
                0 => ['Al Samad Traders', 'Ahsan Traders', 'Shabbir Traders', 'Anwar Traders · Import & Export', 'Karakoram Traders'],
                3 => ['CargoCore Air Cargo Terminal · KHI', 'CargoCore Dry Port Depot · LHE', 'CargoCore Cross-Border Station · Sost'],
                4 => ['SkyLink DWC Freezone Branch', 'SkyLink Port Rashid Depot', 'SkyLink Abu Dhabi Logistics'],
                5 => ['Harbor Line Stevedoring Services', 'Harbor Line Custom Bonded Yard', 'Harbor Line Vessel Agency'],
                7 => ['Indus Valley Freight Terminal', 'Indus Valley Cold Storage Facility'],
            ];
            $subCount = 1;
            foreach ($subCompanyDefs as $compIndex => $subNames) {
                if (! isset($companies[$compIndex])) {
                    continue;
                }
                foreach ($subNames as $j => $name) {
                    SubCompany::firstOrCreate(
                        ['code' => 'SUB-DEMO-'.$subCount],
                        [
                            'name' => $name,
                            'company_id' => $companies[$compIndex]->id,
                            'is_default' => $j === 0,
                            'status' => true,
                            'address' => $companies[$compIndex]->address,
                            'contact_numbers' => [$companies[$compIndex]->contact_number ?? '051-5551212'],
                            'fax_numbers' => [],
                            'mobile_numbers' => [],
                        ]
                    );
                    $subCount++;
                }
            }
            $banks = [];
            foreach ([['National Bank of Pakistan', 'NBP'], ['Habib Bank Limited', 'HBL'], ['Meezan Bank', 'MBL']] as $i => [$name,$short]) {
                $bank = Bank::firstOrCreate(
                    ['code' => 'BNK-DEMO-'.($i + 1)],
                    ['name' => $name, 'short_name' => $short, 'country_id' => $countries['PK']->id]
                );
                if (! $bank->country_id) {
                    $bank->update(['country_id' => $countries['PK']->id]);
                }
                $banks[] = $bank;
                foreach (array_slice($cities, 0, 3) as $j => $city) {
                    BankBranch::firstOrCreate(['code' => 'BRN-DEMO-'.$i.'-'.$j], ['name' => $city->name.' Main Branch', 'bank_id' => $bank->id, 'city_id' => $city->id, 'branch_code' => str_pad((string) ($i * 100 + $j + 1), 4, '0', STR_PAD_LEFT), 'phone_numbers' => []]);
                }
            }
            foreach (['Ahmed Hassan', 'Sara Khan', 'Usman Ali', 'Ayesha Malik', 'Imran Shah', 'Fatima Noor', 'Omar Farooq', 'Zainab Ahmed', 'Bilal Qureshi', 'Maryam Saeed', 'Ali Raza', 'Hina Akhtar'] as $i => $name) {
                $person = Person::firstOrCreate(['code' => 'PER-DEMO-'.($i + 1)], ['name' => $name, 'city_id' => $cities[$i % count($cities)]->id, 'place' => $cities[$i % count($cities)]->name, 'joining_date' => '2026-01-01', 'comments' => 'Demonstration record — replace with verified business information.']);
                PersonContact::firstOrCreate(['person_id' => $person->id, 'label' => 'Office'], ['address' => 'Business District, '.$person->place, 'email' => 'person'.($i + 1).'@example.test']);
                $association = PersonCompany::firstOrCreate(['person_id' => $person->id, 'company_id' => $companies[$i % 3]->id]);
                $type = BusinessType::where('name', ['Customer', 'Vendor', 'Employee', 'Agent'][$i % 4])->firstOrFail();
                PersonClassification::firstOrCreate(['person_company_id' => $association->id, 'business_type_id' => $type->id], ['opening_balance' => null]);
                if ($type->is_employee) {
                    $employee = EmployeeProfile::firstOrCreate(['person_id' => $person->id], ['salary' => '75000.00']);
                    $employee->types()->syncWithoutDetaching([EmployeeType::where('type_number', 3)->firstOrFail()->id]);
                }
                if ($i === 0) {
                    BankOfficer::firstOrCreate(['bank_id' => $banks[0]->id, 'person_id' => $person->id], ['designation' => 'Relationship Manager', 'email' => 'bank.officer@example.test']);
                }
                if ($person->wasRecentlyCreated) {
                    Audit::record('create', 'people', $person->id, [], ['name' => $person->name], null, $person->name);
                }
            }
            foreach (['UTE-RWP' => 'United Trade Express · Rawalpindi', 'KLT-ISB' => 'Karakoram Logistics · Islamabad', 'NGT-KHI' => 'Northern Gateway Trading · Karachi'] as $code => $description) {
                Marka::firstOrCreate(['code' => $code], compact('description'));
            }
        });
    }
}
