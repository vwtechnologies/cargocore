# Persisted fields and screen mapping

Generated from EntityRegistry. Internal numeric IDs and immutable business codes are separate. All fields below have shared form controls in their module/detail panel.

| Screen | Field | Persistence | Control |
| --- | --- | --- | --- |
| Companies | Name | `companies.name` | text |
| Companies | Short name | `companies.short_name` | text |
| Companies | Address | `companies.address` | textarea |
| Companies | Contact number | `companies.contact_number` | text |
| Companies | Fax number | `companies.fax_number` | text |
| Companies | Website | `companies.website` | url |
| Companies | Status | `companies.status` | boolean |
| Companies | Default company | `companies.is_default` | boolean |
| Companies | Generated business code | `companies.code` | Read-only header |
| Sub-companies | Sub-company code | `sub_companies.code` | text |
| Sub-companies | Name | `sub_companies.name` | text |
| Sub-companies | Default sub-company | `sub_companies.is_default` | boolean |
| Sub-companies | Status | `sub_companies.status` | boolean |
| Sub-companies | Address | `sub_companies.address` | textarea |
| Sub-companies | Website | `sub_companies.website` | url |
| Sub-companies | Contact numbers | `sub_companies.contact_numbers` | list |
| Sub-companies | Fax numbers | `sub_companies.fax_numbers` | list |
| Sub-companies | Mobile numbers | `sub_companies.mobile_numbers` | list |
| Sub-companies | Generated business code | `sub_companies.code` | Read-only header |
| Countries | Name | `countries.name` | text |
| Countries | Short name | `countries.short_name` | text |
| Countries | Currency | `countries.currency` | text |
| Countries | Dial code | `countries.dial_code` | text |
| Countries | Display order | `countries.display_sequence` | number |
| Countries | Status | `countries.status` | boolean |
| Countries | Generated business code | `countries.code` | Read-only header |
| Cities | City code | `cities.code` | text |
| Cities | Name | `cities.name` | text |
| Cities | Short name 1 | `cities.short_name_1` | text |
| Cities | Short name 2 | `cities.short_name_2` | text |
| Cities | Status | `cities.status` | boolean |
| Cities | Generated business code | `cities.code` | Read-only header |
| Banks | Name | `banks.name` | text |
| Banks | Short name | `banks.short_name` | text |
| Banks | Country | `banks.country_id` | reference |
| Banks | UAN | `banks.uan` | text |
| Banks | Help line | `banks.help_line` | text |
| Banks | E-Bank | `banks.e_bank` | text |
| Banks | Website | `banks.website` | url |
| Banks | Address | `banks.address` | textarea |
| Banks | Status | `banks.status` | boolean |
| Banks | Generated business code | `banks.code` | Read-only header |
| Branches | Name | `bank_branches.name` | text |
| Branches | Country | `Derived through bank_branches → cities → countries / banks` | reference |
| Branches | City | `bank_branches.city_id` | reference |
| Branches | Branch code | `bank_branches.branch_code` | text |
| Branches | NIFT code | `bank_branches.nift_code` | text |
| Branches | Address | `bank_branches.address` | textarea |
| Branches | Phone numbers | `bank_branches.phone_numbers` | list |
| Branches | Status | `bank_branches.status` | boolean |
| Branches | Generated business code | `bank_branches.code` | Read-only header |
| Bank officers | Person | `bank_officers.person_id` | reference |
| Bank officers | Branch | `bank_officers.bank_branch_id` | reference |
| Bank officers | Officer designation | `bank_officers.designation` | text |
| Bank officers | Contact number | `bank_officers.contact_number` | text |
| Bank officers | Email address | `bank_officers.email` | email |
| Bank officers | Status | `bank_officers.status` | boolean |
| Employee types | Name | `employee_types.name` | text |
| Employee types | Status | `employee_types.status` | boolean |
| Employee types | Generated business code | `employee_types.code` | Backend only (not displayed) |
| Business roles | Name | `business_types.name` | text |
| Business roles | Status | `business_types.status` | boolean |
| Business roles | Generated business code | `business_types.code` | Read-only header |
| Marka | Marka code | `markas.code` | text |
| Marka | Marka description | `markas.description` | textarea |
| Marka | Status | `markas.status` | boolean |
| People | Full name | `people.name` | text |
| People | Father / husband name | `people.father_husband_name` | text |
| People | CNIC | `people.cnic` | text |
| People | Date of birth | `people.date_of_birth` | date |
| People | Gender | `people.gender` | combobox |
| People | NTN | `people.ntn` | text |
| People | STRN | `people.strn` | text |
| People | Place (city) | `people.city_id` | reference |
| People | Joining date | `people.joining_date` | date |
| People | Place | `people.place` | text |
| People | Comments | `people.comments` | textarea |
| People | Status | `people.status` | boolean |
| People | Employee | `people.is_employee` | boolean |
| People | Generated business code | `people.code` | Read-only header |
| Contacts | Label | `person_contacts.label` | text |
| Contacts | Address | `person_contacts.address` | textarea |
| Contacts | Phone number | `person_contacts.phone` | text |
| Contacts | Mobile number | `person_contacts.mobile` | text |
| Contacts | Email address | `person_contacts.email` | email |
| Contacts | Status | `person_contacts.status` | boolean |
| Markas | Marka code | `person_markas.marka_id` | reference |
| Markas | Status | `person_markas.status` | boolean |
| Bank accounts | Bank | `Derived through bank_branches → cities → countries / banks` | reference |
| Bank accounts | Country | `Derived through bank_branches → cities → countries / banks` | reference |
| Bank accounts | City | `Derived through bank_branches → cities → countries / banks` | reference |
| Bank accounts | Branch | `person_bank_accounts.bank_branch_id` | reference |
| Bank accounts | Account number | `person_bank_accounts.account_number` | text |
| Bank accounts | IBAN | `person_bank_accounts.iban` | text |
| Bank accounts | Account title | `person_bank_accounts.account_title` | text |
| Bank accounts | Status | `person_bank_accounts.status` | boolean |
| Company associations | Company | `person_companies.company_id` | reference |
| Company associations | Status | `person_companies.status` | boolean |
| Business role assignments | Business role | `person_classifications.business_type_id` | reference |
| Business role assignments | Opening amount (PKR) | `person_classifications.opening_balance` | money |
| Business role assignments | Status | `person_classifications.status` | boolean |

Additional dedicated sections: employee_profiles.salary (PKR), employee_profile_type (multiple employee types); documents (kind, document_type, document_number, expires_on, private file metadata) for profile/signature/identification upload/view/replace; users (username, password hash, role, active status, person link), company_user and permission_role. These fields are exposed through dedicated person/administration screens. Officer name comes from the selected person's name; account country/city/bank come from its branch. Marka codes are shared masters; person_markas links multiple codes to each person without duplicating master records.
