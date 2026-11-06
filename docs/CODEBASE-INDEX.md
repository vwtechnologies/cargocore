# CargoCore ERP codebase index

Indexed 2026-11-05T15:20:41.050911+05:00. Source snapshot only; test results were not rerun for indexing.

169 files · 23,827 source/documentation lines · 243 PHP symbols · 84 JS/TS symbols · 15 entity contracts · 37 model relationships.

Machine-readable manifest, symbols, imports, routes, field contracts and SHA-256 fingerprints: [codebase-index.json](codebase-index.json).

## Current application entry points

| Purpose | Source |
| --- | --- |
| React router and providers | [resources/js/app.tsx](../resources/js/app.tsx) |
| Laravel bootstrap, middleware and error responses | [bootstrap/app.php](../bootstrap/app.php) |
| API routes and SPA fallback | [routes/web.php](../routes/web.php) |
| Entity/field metadata and permission definitions | [app/Modules/Shared/EntityRegistry.php](../app/Modules/Shared/EntityRegistry.php) |
| Transactional writes and optimistic versions | [app/Modules/Shared/RecordService.php](../app/Modules/Shared/RecordService.php) |
| Integrity rules and deletion/default checks | [app/Modules/Shared/DomainRules.php](../app/Modules/Shared/DomainRules.php) |

## Module map

### Application shell and authentication

- Frontend: [resources/js/app.tsx](../resources/js/app.tsx), [resources/js/components/Shell.tsx](../resources/js/components/Shell.tsx), [resources/js/pages/Auth.tsx](../resources/js/pages/Auth.tsx), [resources/js/lib/session.tsx](../resources/js/lib/session.tsx), [resources/js/lib/dirty.tsx](../resources/js/lib/dirty.tsx).
- Backend: [bootstrap/app.php](../bootstrap/app.php), [app/Providers/FortifyServiceProvider.php](../app/Providers/FortifyServiceProvider.php), [app/Providers/AppServiceProvider.php](../app/Providers/AppServiceProvider.php), [app/Http/Middleware/SecureAccountSession.php](../app/Http/Middleware/SecureAccountSession.php), [app/Http/Middleware/EnsureAccountReady.php](../app/Http/Middleware/EnsureAccountReady.php), [app/Actions/Fortify/UpdateUserPassword.php](../app/Actions/Fortify/UpdateUserPassword.php).

### Companies and sub-companies

Entities: `companies`, `sub-companies`.

- Frontend: [resources/js/pages/CompaniesPage.tsx](../resources/js/pages/CompaniesPage.tsx).
- Models: [app/Models/Company.php](../app/Models/Company.php), [app/Models/SubCompany.php](../app/Models/SubCompany.php).

### Countries and cities

Entities: `countries`, `cities`.

- Frontend: [resources/js/pages/CountriesPage.tsx](../resources/js/pages/CountriesPage.tsx).
- Models: [app/Models/Country.php](../app/Models/Country.php), [app/Models/City.php](../app/Models/City.php).

### Banking and officers

Entities: `banks`, `branches`, `officers`.

- Frontend: [resources/js/pages/BanksPage.tsx](../resources/js/pages/BanksPage.tsx).
- Models: [app/Models/Bank.php](../app/Models/Bank.php), [app/Models/BankBranch.php](../app/Models/BankBranch.php), [app/Models/BankOfficer.php](../app/Models/BankOfficer.php).

### Employee types

Entities: `employee-types`.

- Frontend: [resources/js/pages/EmployeeTypesPage.tsx](../resources/js/pages/EmployeeTypesPage.tsx).
- Models: [app/Models/EmployeeType.php](../app/Models/EmployeeType.php).

### People and relationships

Entities: `people`, `contacts`, `accounts`, `associations`, `classifications`.

- Frontend: [resources/js/pages/Modules.tsx](../resources/js/pages/Modules.tsx), [resources/js/pages/PersonSections.tsx](../resources/js/pages/PersonSections.tsx).
- Backend: [app/Http/Controllers/Api/EmployeeController.php](../app/Http/Controllers/Api/EmployeeController.php), [app/Http/Controllers/Api/DocumentController.php](../app/Http/Controllers/Api/DocumentController.php).
- Models: [app/Models/Person.php](../app/Models/Person.php), [app/Models/PersonContact.php](../app/Models/PersonContact.php), [app/Models/PersonBankAccount.php](../app/Models/PersonBankAccount.php), [app/Models/PersonCompany.php](../app/Models/PersonCompany.php), [app/Models/PersonClassification.php](../app/Models/PersonClassification.php), [app/Models/EmployeeProfile.php](../app/Models/EmployeeProfile.php), [app/Models/Document.php](../app/Models/Document.php).

### Business types and MARKA

Entities: `business-types`, `markas`.

- Frontend: [resources/js/pages/Modules.tsx](../resources/js/pages/Modules.tsx).
- Models: [app/Models/BusinessType.php](../app/Models/BusinessType.php), [app/Models/Marka.php](../app/Models/Marka.php).

### Users, roles and audit

- Frontend: [resources/js/pages/Administration.tsx](../resources/js/pages/Administration.tsx).
- Backend: [app/Http/Controllers/Api/AccessController.php](../app/Http/Controllers/Api/AccessController.php), [app/Http/Controllers/Api/DashboardController.php](../app/Http/Controllers/Api/DashboardController.php), [app/Modules/Access/Access.php](../app/Modules/Access/Access.php), [app/Modules/Shared/Audit.php](../app/Modules/Shared/Audit.php).
- Models: [app/Models/User.php](../app/Models/User.php), [app/Models/Role.php](../app/Models/Role.php), [app/Models/Permission.php](../app/Models/Permission.php), [app/Models/AuditEvent.php](../app/Models/AuditEvent.php).

### Shared CRUD and contracts

- Frontend: [resources/js/components/Records.tsx](../resources/js/components/Records.tsx), [resources/js/components/RecordForm.tsx](../resources/js/components/RecordForm.tsx), [resources/js/components/MasterDetailShell.tsx](../resources/js/components/MasterDetailShell.tsx), [resources/js/components/SearchableSelect.tsx](../resources/js/components/SearchableSelect.tsx), [resources/js/components/ReferenceSelect.tsx](../resources/js/components/ReferenceSelect.tsx), [resources/js/lib/api.ts](../resources/js/lib/api.ts), [resources/js/lib/validation.ts](../resources/js/lib/validation.ts).
- Backend: [app/Modules/Shared/EntityRegistry.php](../app/Modules/Shared/EntityRegistry.php), [app/Modules/Shared/RecordService.php](../app/Modules/Shared/RecordService.php), [app/Modules/Shared/DomainRules.php](../app/Modules/Shared/DomainRules.php), [app/Modules/Shared/ApiContracts.php](../app/Modules/Shared/ApiContracts.php), [app/Http/Controllers/Api/RecordController.php](../app/Http/Controllers/Api/RecordController.php), [app/Console/Commands/GenerateContracts.php](../app/Console/Commands/GenerateContracts.php).

### Windows deployment and recovery

- Backend: [app/Console/Commands/HealthCheck.php](../app/Console/Commands/HealthCheck.php), [app/Console/Commands/VerifyFiles.php](../app/Console/Commands/VerifyFiles.php), [app/Console/Commands/DatabaseGrants.php](../app/Console/Commands/DatabaseGrants.php), [app/Console/Commands/CreateAdministrator.php](../app/Console/Commands/CreateAdministrator.php).
- Paths: [deploy/windows/Backup.ps1](../deploy/windows/Backup.ps1), [deploy/windows/Caddyfile.template](../deploy/windows/Caddyfile.template), [deploy/windows/Common.ps1](../deploy/windows/Common.ps1), [deploy/windows/Health.ps1](../deploy/windows/Health.ps1), [deploy/windows/Install.ps1](../deploy/windows/Install.ps1), [deploy/windows/Register-Tasks.ps1](../deploy/windows/Register-Tasks.ps1), [deploy/windows/Restore.ps1](../deploy/windows/Restore.ps1), [deploy/windows/Update.ps1](../deploy/windows/Update.ps1), [deploy/windows/database.sql](../deploy/windows/database.sql), [deploy/windows/httpd-cargocore.conf.template](../deploy/windows/httpd-cargocore.conf.template), [deploy/windows/operations.example.json](../deploy/windows/operations.example.json), [deploy/windows/production.env.example](../deploy/windows/production.env.example).

## Updated source areas

- Dedicated `CompaniesPage`, `CountriesPage`, `BanksPage`, and `EmployeeTypesPage` routes now precede the generic module route.
- `MasterDetailShell` provides shared master/detail layout and save shortcuts; `SearchableSelect` provides a reusable searchable selector. Companies retain their dedicated screen implementation.
- New additive migrations include country currency/dial code, bank and branch addresses, employee-type description, and an optional bank country relationship.
- `tests/e2e/bank_shortcuts.spec.ts` is present alongside the broader workspace browser journeys. Presence in this index does not imply the updated suite has been executed.

## Entity contracts and parent relationships

| Entity | Model | Permission module | Parent | Field keys |
| --- | --- | --- | --- | --- |
| `companies` | `Company` | `companies` | Shared/root master | `name`, `short_name`, `address`, `contact_number`, `fax_number`, `website`, `status`, `is_default` |
| `sub-companies` | `SubCompany` | `companies` | `companies` via `company_id` | `code`, `name`, `is_default`, `status`, `address`, `website`, `contact_numbers`, `fax_numbers`, `mobile_numbers` |
| `countries` | `Country` | `geography` | Shared/root master | `name`, `short_name`, `currency`, `dial_code`, `display_sequence`, `status` |
| `cities` | `City` | `geography` | `countries` via `country_id` | `code`, `name`, `short_name_1`, `short_name_2`, `status` |
| `banks` | `Bank` | `banks` | Shared/root master | `name`, `short_name`, `country_id`, `uan`, `help_line`, `e_bank`, `website`, `address`, `status` |
| `branches` | `BankBranch` | `banks` | `banks` via `bank_id` | `name`, `country_id`, `city_id`, `branch_code`, `nift_code`, `address`, `phone_numbers`, `status` |
| `officers` | `BankOfficer` | `banks` | `banks` via `bank_id` | `person_id`, `bank_branch_id`, `designation`, `contact_number`, `email`, `status` |
| `employee-types` | `EmployeeType` | `employee-types` | Shared/root master | `code`, `name`, `description`, `type_number`, `status` |
| `business-types` | `BusinessType` | `business-types` | Shared/root master | `name`, `status` |
| `markas` | `Marka` | `markas` | Shared/root master | `code`, `description`, `status` |
| `people` | `Person` | `people` | Shared/root master | `name`, `father_husband_name`, `cnic`, `date_of_birth`, `gender`, `ntn`, `strn`, `joining_date`, `place`, `comments`, `status` |
| `contacts` | `PersonContact` | `people` | `people` via `person_id` | `label`, `address`, `phone`, `mobile`, `email`, `status` |
| `accounts` | `PersonBankAccount` | `person-accounts` | `people` via `person_id` | `bank_id`, `country_id`, `city_id`, `bank_branch_id`, `account_number`, `iban`, `account_title`, `status` |
| `associations` | `PersonCompany` | `associations` | `people` via `person_id` | `company_id`, `status` |
| `classifications` | `PersonClassification` | `associations` | `associations` via `person_company_id` | `business_type_id`, `opening_balance`, `status` |

## Frontend routes

| Route | Screen |
| --- | --- |
| `/` | `Dashboard` |
| `/security` | `Security` |
| `/companies/:id?` | `CompaniesPage` |
| `/countries/:id?` | `CountriesPage` |
| `/banks/:id?` | `BanksPage` |
| `/employee-types/:id?` | `EmployeeTypesPage` |
| `/users` | `UsersPage` |
| `/roles` | `RolesPage` |
| `/audit` | `AuditPage` |
| `/:entity/:id?` | `ModulePage` |

## API dispatch

Business routes use `/api/v1` and session authentication. Readiness middleware gates business access until required password/MFA setup is complete. Root and nested generic resource routes dispatch through `RecordController`; `EntityRegistry` defines valid resources and ownership. Dedicated routes handle users/roles, dashboard/audit, employee details, documents/downloads and classification batches. See [API.md](API.md) for request/response behavior.

| Method | URI | Action |
| --- | --- | --- |
| `POST` | `/api/v1/associations/{association}/classifications/batch` | `App\Http\Controllers\Api\RecordController@batchClassifications` |
| `GET|HEAD` | `/api/v1/audit` | `App\Http\Controllers\Api\DashboardController@audit` |
| `GET|HEAD` | `/api/v1/dashboard` | `App\Http\Controllers\Api\DashboardController@show` |
| `GET|POST|HEAD` | `/api/v1/people/{person}/documents` | `App\Http\Controllers\Api\DocumentController@handle` |
| `GET|HEAD` | `/api/v1/people/{person}/documents/{document}/download` | `App\Http\Controllers\Api\DocumentController@download` |
| `POST|DELETE` | `/api/v1/people/{person}/documents/{id}` | `App\Http\Controllers\Api\DocumentController@handle` |
| `GET|PUT|HEAD` | `/api/v1/people/{person}/employee` | `App\Http\Controllers\Api\EmployeeController@handle` |
| `GET|POST|HEAD` | `/api/v1/roles` | `App\Http\Controllers\Api\AccessController@roles` |
| `PUT` | `/api/v1/roles/{id}` | `App\Http\Controllers\Api\AccessController@roles` |
| `GET|HEAD` | `/api/v1/session` | `App\Http\Controllers\Api\SessionController@show` |
| `GET|POST|HEAD` | `/api/v1/users` | `App\Http\Controllers\Api\AccessController@users` |
| `PUT` | `/api/v1/users/{id}` | `App\Http\Controllers\Api\AccessController@users` |
| `GET|POST|PUT|PATCH|DELETE|HEAD` | `/api/v1/{entity}/{id?}` | `App\Http\Controllers\Api\RecordController@handle` |
| `GET|POST|PUT|PATCH|DELETE|HEAD` | `/api/v1/{parentEntity}/{parentId}/{entity}/{id?}` | `Closure` |

## Migrations

| Migration | Tables created/altered in up() |
| --- | --- |
| [database/migrations/0001_01_01_000000_create_users_table.php](../database/migrations/0001_01_01_000000_create_users_table.php) | `users` (create), `password_reset_tokens` (create), `sessions` (create) |
| [database/migrations/0001_01_01_000001_create_cache_table.php](../database/migrations/0001_01_01_000001_create_cache_table.php) | `cache` (create), `cache_locks` (create) |
| [database/migrations/0001_01_01_000002_create_jobs_table.php](../database/migrations/0001_01_01_000002_create_jobs_table.php) | `jobs` (create), `job_batches` (create), `failed_jobs` (create) |
| [database/migrations/2026_11_04_130653_create_erp_foundation.php](../database/migrations/2026_11_04_130653_create_erp_foundation.php) | `record_locks` (create), `roles` (create), `permissions` (create), `permission_role` (create), `companies` (create), `company_user` (create), `sub_companies` (create), `countries` (create), `cities` (create), `banks` (create), `bank_branches` (create), `employee_types` (create), `business_types` (create), `markas` (create), `people` (create), `person_contacts` (create), `bank_officers` (create), `person_bank_accounts` (create), `person_companies` (create), `person_classifications` (create), `employee_profiles` (create), `employee_profile_type` (create), `documents` (create), `users` (table), `audit_events` (create) |
| [database/migrations/2026_11_04_130654_add_two_factor_columns_to_users_table.php](../database/migrations/2026_11_04_130654_add_two_factor_columns_to_users_table.php) | `users` (table) |
| [database/migrations/2026_11_04_130655_create_passkeys_table.php](../database/migrations/2026_11_04_130655_create_passkeys_table.php) | `passkeys` (create) |
| [database/migrations/2026_11_04_210221_add_currency_and_dial_code_to_countries_table.php](../database/migrations/2026_11_04_210221_add_currency_and_dial_code_to_countries_table.php) | `countries` (table) |
| [database/migrations/2026_11_04_220708_add_address_to_banks_and_bank_branches_tables.php](../database/migrations/2026_11_04_220708_add_address_to_banks_and_bank_branches_tables.php) | `banks` (table), `bank_branches` (table) |
| [database/migrations/2026_11_04_223245_add_description_to_employee_types_table.php](../database/migrations/2026_11_04_223245_add_description_to_employee_types_table.php) | `employee_types` (table) |
| [database/migrations/2026_11_05_092027_add_country_id_to_banks_table.php](../database/migrations/2026_11_05_092027_add_country_id_to_banks_table.php) | `banks` (table) |

## Model relationship declarations

| Model | Method | Relationship | Target/arguments |
| --- | --- | --- | --- |
| `AuditEvent` | `actor` | `belongsTo` | `User::class, 'user_id'` |
| `Bank` | `country` | `belongsTo` | `Country::class` |
| `Bank` | `branches` | `hasMany` | `BankBranch::class` |
| `Bank` | `officers` | `hasMany` | `BankOfficer::class` |
| `BankBranch` | `bank` | `belongsTo` | `Bank::class` |
| `BankBranch` | `city` | `belongsTo` | `City::class` |
| `BankBranch` | `officers` | `hasMany` | `BankOfficer::class` |
| `BankOfficer` | `person` | `belongsTo` | `Person::class` |
| `BankOfficer` | `bank` | `belongsTo` | `Bank::class` |
| `BankOfficer` | `branch` | `belongsTo` | `BankBranch::class, 'bank_branch_id'` |
| `City` | `country` | `belongsTo` | `Country::class` |
| `Company` | `subCompanies` | `hasMany` | `SubCompany::class` |
| `Company` | `people` | `hasMany` | `PersonCompany::class` |
| `Country` | `cities` | `hasMany` | `City::class` |
| `Document` | `person` | `belongsTo` | `Person::class` |
| `EmployeeProfile` | `person` | `belongsTo` | `Person::class` |
| `EmployeeProfile` | `types` | `belongsToMany` | `EmployeeType::class, 'employee_profile_type'` |
| `Person` | `contacts` | `hasMany` | `PersonContact::class` |
| `Person` | `accounts` | `hasMany` | `PersonBankAccount::class` |
| `Person` | `associations` | `hasMany` | `PersonCompany::class` |
| `Person` | `documents` | `hasMany` | `Document::class` |
| `Person` | `employeeProfile` | `hasOne` | `EmployeeProfile::class` |
| `Person` | `user` | `hasOne` | `User::class` |
| `PersonBankAccount` | `person` | `belongsTo` | `Person::class` |
| `PersonBankAccount` | `branch` | `belongsTo` | `BankBranch::class, 'bank_branch_id'` |
| `PersonClassification` | `association` | `belongsTo` | `PersonCompany::class, 'person_company_id'` |
| `PersonClassification` | `businessType` | `belongsTo` | `BusinessType::class` |
| `PersonCompany` | `person` | `belongsTo` | `Person::class` |
| `PersonCompany` | `company` | `belongsTo` | `Company::class` |
| `PersonCompany` | `classifications` | `hasMany` | `PersonClassification::class` |
| `PersonContact` | `person` | `belongsTo` | `Person::class` |
| `Role` | `permissions` | `belongsToMany` | `Permission::class` |
| `Role` | `users` | `hasMany` | `User::class` |
| `SubCompany` | `company` | `belongsTo` | `Company::class` |
| `User` | `role` | `belongsTo` | `Role::class` |
| `User` | `person` | `belongsTo` | `Person::class` |
| `User` | `companies` | `belongsToMany` | `Company::class` |

## Tests and operations

- Backend feature tests: access/company scope, relational integrity and defaults, documents/authentication, filtered navigation/classification batches, and recovery file integrity.
- Frontend tests: form validation, UI interaction and exact PKR presentation.
- Browser tests: workspace journeys plus bank keyboard shortcuts. Run browser and PHP tests sequentially because they share the dedicated test database.
- Operations: Windows PowerShell installation/update/tasks, Caddy/Apache templates, encrypted backup/restore scripts and health/file-verification CLI commands.
- Existing test evidence: [VERIFICATION.md](VERIFICATION.md). Commissioning details: [DEPLOYMENT.md](DEPLOYMENT.md).

## Contract snapshot observations

The checked-in OpenAPI snapshot omits fields present in the current entity registry. This index records that drift without regenerating application artifacts.

- `banks`: `country_id`.

## Indexed files

| Area | Files |
| --- | --- |
| backend | 45 |
| configuration | 31 |
| database | 31 |
| deployment | 12 |
| documentation | 9 |
| frontend | 25 |
| tests | 16 |

Each file below has size, line count and SHA-256 metadata in the JSON index. Dependency/lock and generated-contract files are fingerprinted; their expanded symbols are excluded to keep application definitions easy to find. Runtime environment files, uploads, logs, database data, dependencies, build assets and browser credentials are excluded.

### Backend

- [app/Actions/Fortify/UpdateUserPassword.php](../app/Actions/Fortify/UpdateUserPassword.php)
- [app/Console/Commands/CreateAdministrator.php](../app/Console/Commands/CreateAdministrator.php)
- [app/Console/Commands/DatabaseGrants.php](../app/Console/Commands/DatabaseGrants.php)
- [app/Console/Commands/GenerateContracts.php](../app/Console/Commands/GenerateContracts.php)
- [app/Console/Commands/HealthCheck.php](../app/Console/Commands/HealthCheck.php)
- [app/Console/Commands/VerifyFiles.php](../app/Console/Commands/VerifyFiles.php)
- [app/Http/Controllers/Api/AccessController.php](../app/Http/Controllers/Api/AccessController.php)
- [app/Http/Controllers/Api/DashboardController.php](../app/Http/Controllers/Api/DashboardController.php)
- [app/Http/Controllers/Api/DocumentController.php](../app/Http/Controllers/Api/DocumentController.php)
- [app/Http/Controllers/Api/EmployeeController.php](../app/Http/Controllers/Api/EmployeeController.php)
- [app/Http/Controllers/Api/RecordController.php](../app/Http/Controllers/Api/RecordController.php)
- [app/Http/Controllers/Api/SessionController.php](../app/Http/Controllers/Api/SessionController.php)
- [app/Http/Controllers/Controller.php](../app/Http/Controllers/Controller.php)
- [app/Http/Middleware/EnsureAccountReady.php](../app/Http/Middleware/EnsureAccountReady.php)
- [app/Http/Middleware/SecureAccountSession.php](../app/Http/Middleware/SecureAccountSession.php)
- [app/Models/AuditEvent.php](../app/Models/AuditEvent.php)
- [app/Models/Bank.php](../app/Models/Bank.php)
- [app/Models/BankBranch.php](../app/Models/BankBranch.php)
- [app/Models/BankOfficer.php](../app/Models/BankOfficer.php)
- [app/Models/BusinessType.php](../app/Models/BusinessType.php)
- [app/Models/City.php](../app/Models/City.php)
- [app/Models/Company.php](../app/Models/Company.php)
- [app/Models/Country.php](../app/Models/Country.php)
- [app/Models/Document.php](../app/Models/Document.php)
- [app/Models/EmployeeProfile.php](../app/Models/EmployeeProfile.php)
- [app/Models/EmployeeType.php](../app/Models/EmployeeType.php)
- [app/Models/Marka.php](../app/Models/Marka.php)
- [app/Models/Permission.php](../app/Models/Permission.php)
- [app/Models/Person.php](../app/Models/Person.php)
- [app/Models/PersonBankAccount.php](../app/Models/PersonBankAccount.php)
- [app/Models/PersonClassification.php](../app/Models/PersonClassification.php)
- [app/Models/PersonCompany.php](../app/Models/PersonCompany.php)
- [app/Models/PersonContact.php](../app/Models/PersonContact.php)
- [app/Models/Record.php](../app/Models/Record.php)
- [app/Models/Role.php](../app/Models/Role.php)
- [app/Models/SubCompany.php](../app/Models/SubCompany.php)
- [app/Models/User.php](../app/Models/User.php)
- [app/Modules/Access/Access.php](../app/Modules/Access/Access.php)
- [app/Modules/Shared/ApiContracts.php](../app/Modules/Shared/ApiContracts.php)
- [app/Modules/Shared/Audit.php](../app/Modules/Shared/Audit.php)
- [app/Modules/Shared/DomainRules.php](../app/Modules/Shared/DomainRules.php)
- [app/Modules/Shared/EntityRegistry.php](../app/Modules/Shared/EntityRegistry.php)
- [app/Modules/Shared/RecordService.php](../app/Modules/Shared/RecordService.php)
- [app/Providers/AppServiceProvider.php](../app/Providers/AppServiceProvider.php)
- [app/Providers/FortifyServiceProvider.php](../app/Providers/FortifyServiceProvider.php)

### Configuration

- [.gitignore](../.gitignore)
- [artisan](../artisan)
- [bootstrap/app.php](../bootstrap/app.php)
- [bootstrap/providers.php](../bootstrap/providers.php)
- [compose.dev.yaml](../compose.dev.yaml)
- [composer.json](../composer.json)
- [composer.lock](../composer.lock)
- [config/app.php](../config/app.php)
- [config/auth.php](../config/auth.php)
- [config/cache.php](../config/cache.php)
- [config/database.php](../config/database.php)
- [config/filesystems.php](../config/filesystems.php)
- [config/fortify.php](../config/fortify.php)
- [config/logging.php](../config/logging.php)
- [config/mail.php](../config/mail.php)
- [config/queue.php](../config/queue.php)
- [config/services.php](../config/services.php)
- [config/session.php](../config/session.php)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [phpunit.xml](../phpunit.xml)
- [playwright.config.ts](../playwright.config.ts)
- [public/favicon.ico](../public/favicon.ico)
- [public/favicon.svg](../public/favicon.svg)
- [public/index.php](../public/index.php)
- [public/robots.txt](../public/robots.txt)
- [routes/console.php](../routes/console.php)
- [routes/web.php](../routes/web.php)
- [tsconfig.json](../tsconfig.json)
- [vite.config.js](../vite.config.js)
- [vitest.config.ts](../vitest.config.ts)

### Database

- [database/factories/BankBranchFactory.php](../database/factories/BankBranchFactory.php)
- [database/factories/BankFactory.php](../database/factories/BankFactory.php)
- [database/factories/BankOfficerFactory.php](../database/factories/BankOfficerFactory.php)
- [database/factories/BusinessTypeFactory.php](../database/factories/BusinessTypeFactory.php)
- [database/factories/CityFactory.php](../database/factories/CityFactory.php)
- [database/factories/CompanyFactory.php](../database/factories/CompanyFactory.php)
- [database/factories/CountryFactory.php](../database/factories/CountryFactory.php)
- [database/factories/EmployeeProfileFactory.php](../database/factories/EmployeeProfileFactory.php)
- [database/factories/EmployeeTypeFactory.php](../database/factories/EmployeeTypeFactory.php)
- [database/factories/MarkaFactory.php](../database/factories/MarkaFactory.php)
- [database/factories/PersonBankAccountFactory.php](../database/factories/PersonBankAccountFactory.php)
- [database/factories/PersonClassificationFactory.php](../database/factories/PersonClassificationFactory.php)
- [database/factories/PersonCompanyFactory.php](../database/factories/PersonCompanyFactory.php)
- [database/factories/PersonContactFactory.php](../database/factories/PersonContactFactory.php)
- [database/factories/PersonFactory.php](../database/factories/PersonFactory.php)
- [database/factories/RoleFactory.php](../database/factories/RoleFactory.php)
- [database/factories/SubCompanyFactory.php](../database/factories/SubCompanyFactory.php)
- [database/factories/UserFactory.php](../database/factories/UserFactory.php)
- [database/migrations/0001_01_01_000000_create_users_table.php](../database/migrations/0001_01_01_000000_create_users_table.php)
- [database/migrations/0001_01_01_000001_create_cache_table.php](../database/migrations/0001_01_01_000001_create_cache_table.php)
- [database/migrations/0001_01_01_000002_create_jobs_table.php](../database/migrations/0001_01_01_000002_create_jobs_table.php)
- [database/migrations/2026_11_04_130653_create_erp_foundation.php](../database/migrations/2026_11_04_130653_create_erp_foundation.php)
- [database/migrations/2026_11_04_130654_add_two_factor_columns_to_users_table.php](../database/migrations/2026_11_04_130654_add_two_factor_columns_to_users_table.php)
- [database/migrations/2026_11_04_130655_create_passkeys_table.php](../database/migrations/2026_11_04_130655_create_passkeys_table.php)
- [database/migrations/2026_11_04_210221_add_currency_and_dial_code_to_countries_table.php](../database/migrations/2026_11_04_210221_add_currency_and_dial_code_to_countries_table.php)
- [database/migrations/2026_11_04_220708_add_address_to_banks_and_bank_branches_tables.php](../database/migrations/2026_11_04_220708_add_address_to_banks_and_bank_branches_tables.php)
- [database/migrations/2026_11_04_223245_add_description_to_employee_types_table.php](../database/migrations/2026_11_04_223245_add_description_to_employee_types_table.php)
- [database/migrations/2026_11_05_092027_add_country_id_to_banks_table.php](../database/migrations/2026_11_05_092027_add_country_id_to_banks_table.php)
- [database/seeders/DatabaseSeeder.php](../database/seeders/DatabaseSeeder.php)
- [database/seeders/DemoSeeder.php](../database/seeders/DemoSeeder.php)
- [database/seeders/E2ESeeder.php](../database/seeders/E2ESeeder.php)

### Deployment

- [deploy/windows/Backup.ps1](../deploy/windows/Backup.ps1)
- [deploy/windows/Caddyfile.template](../deploy/windows/Caddyfile.template)
- [deploy/windows/Common.ps1](../deploy/windows/Common.ps1)
- [deploy/windows/Health.ps1](../deploy/windows/Health.ps1)
- [deploy/windows/Install.ps1](../deploy/windows/Install.ps1)
- [deploy/windows/Register-Tasks.ps1](../deploy/windows/Register-Tasks.ps1)
- [deploy/windows/Restore.ps1](../deploy/windows/Restore.ps1)
- [deploy/windows/Update.ps1](../deploy/windows/Update.ps1)
- [deploy/windows/database.sql](../deploy/windows/database.sql)
- [deploy/windows/httpd-cargocore.conf.template](../deploy/windows/httpd-cargocore.conf.template)
- [deploy/windows/operations.example.json](../deploy/windows/operations.example.json)
- [deploy/windows/production.env.example](../deploy/windows/production.env.example)

### Documentation

- [AGENTS.md](../AGENTS.md)
- [CLAUDE.md](../CLAUDE.md)
- [README.md](../README.md)
- [docs/API.md](../docs/API.md)
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
- [docs/FIELD-MAP.md](../docs/FIELD-MAP.md)
- [docs/VERIFICATION.md](../docs/VERIFICATION.md)
- [docs/openapi.json](../docs/openapi.json)

### Frontend

- [resources/css/app.css](../resources/css/app.css)
- [resources/js/app.tsx](../resources/js/app.tsx)
- [resources/js/components/MasterDetailShell.tsx](../resources/js/components/MasterDetailShell.tsx)
- [resources/js/components/RecordForm.tsx](../resources/js/components/RecordForm.tsx)
- [resources/js/components/Records.tsx](../resources/js/components/Records.tsx)
- [resources/js/components/ReferenceSelect.tsx](../resources/js/components/ReferenceSelect.tsx)
- [resources/js/components/SearchableSelect.tsx](../resources/js/components/SearchableSelect.tsx)
- [resources/js/components/Shell.tsx](../resources/js/components/Shell.tsx)
- [resources/js/components/ui.tsx](../resources/js/components/ui.tsx)
- [resources/js/lib/api.ts](../resources/js/lib/api.ts)
- [resources/js/lib/contracts.generated.ts](../resources/js/lib/contracts.generated.ts)
- [resources/js/lib/dirty.tsx](../resources/js/lib/dirty.tsx)
- [resources/js/lib/session.tsx](../resources/js/lib/session.tsx)
- [resources/js/lib/types.ts](../resources/js/lib/types.ts)
- [resources/js/lib/validation.ts](../resources/js/lib/validation.ts)
- [resources/js/pages/Administration.tsx](../resources/js/pages/Administration.tsx)
- [resources/js/pages/Auth.tsx](../resources/js/pages/Auth.tsx)
- [resources/js/pages/BanksPage.tsx](../resources/js/pages/BanksPage.tsx)
- [resources/js/pages/CompaniesPage.tsx](../resources/js/pages/CompaniesPage.tsx)
- [resources/js/pages/CountriesPage.tsx](../resources/js/pages/CountriesPage.tsx)
- [resources/js/pages/Dashboard.tsx](../resources/js/pages/Dashboard.tsx)
- [resources/js/pages/EmployeeTypesPage.tsx](../resources/js/pages/EmployeeTypesPage.tsx)
- [resources/js/pages/Modules.tsx](../resources/js/pages/Modules.tsx)
- [resources/js/pages/PersonSections.tsx](../resources/js/pages/PersonSections.tsx)
- [resources/views/app.blade.php](../resources/views/app.blade.php)

### Tests

- [tests/ErpTestCase.php](../tests/ErpTestCase.php)
- [tests/Feature/AccessSecurityTest.php](../tests/Feature/AccessSecurityTest.php)
- [tests/Feature/DocumentsAndAuthenticationTest.php](../tests/Feature/DocumentsAndAuthenticationTest.php)
- [tests/Feature/ExampleTest.php](../tests/Feature/ExampleTest.php)
- [tests/Feature/FoundationTest.php](../tests/Feature/FoundationTest.php)
- [tests/Feature/NavigationAndBatchTest.php](../tests/Feature/NavigationAndBatchTest.php)
- [tests/Feature/RecoveryIntegrityTest.php](../tests/Feature/RecoveryIntegrityTest.php)
- [tests/TestCase.php](../tests/TestCase.php)
- [tests/Unit/ExampleTest.php](../tests/Unit/ExampleTest.php)
- [tests/e2e/bank_shortcuts.spec.ts](../tests/e2e/bank_shortcuts.spec.ts)
- [tests/e2e/setup.ts](../tests/e2e/setup.ts)
- [tests/e2e/workspace.spec.ts](../tests/e2e/workspace.spec.ts)
- [tests/frontend/api.test.ts](../tests/frontend/api.test.ts)
- [tests/frontend/setup.ts](../tests/frontend/setup.ts)
- [tests/frontend/ui.test.tsx](../tests/frontend/ui.test.tsx)
- [tests/frontend/validation.test.ts](../tests/frontend/validation.test.ts)
