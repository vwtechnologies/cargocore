# CargoCore ERP Project Handoff

24 November 2026

CargoCore is a browser-based ERP for maintaining company, people, banking, and reference data. This handoff gives the development and hosting teams the release status, business rules, and steps to run, deploy, and recover the application. The client demo uses cPanel. A separate Windows deployment runbook is available for on-premises use.

## Release and workspace status

| Item | Current state |
| --- | --- |
| Source repository | `vwtechnologies/cargocore` on GitHub, branch `main`. [Repository](https://github.com/vwtechnologies/cargocore) |
| Committed baseline | Local `HEAD` and the locally recorded `origin/main` point to `ab0d47d`. This includes the cPanel login fixes, mobile layout fixes, and form and typography refinements. |
| Local changes awaiting release | The five Company Management tabs, reusable company addresses, legal company fields in Person Bank Accounts, and restored dark green and mint palette are present as working-tree changes with generated contracts, frontend build assets, and tests. |
| Client demo target | `https://cargocore.vwisdomtechnologies.com/`. The hosting owner manages Git pulls, cPanel File Manager, and phpMyAdmin. The exact deployed revision and live schema still need confirmation in cPanel. |
| Local runtime at handoff | The Laravel listener on `8011` and the configured Colima Docker socket were unavailable when checked. A `public/hot` marker is present. See the startup instructions before testing the compiled build. |

The SQL dump and cPanel ZIPs in `storage/app/private/client-demo/` are earlier demo artifacts. The dump has the original Companies and Person Bank Accounts tables and predates the local Company Management migration. The ZIPs predate both the Company Management and palette changes. Use the release checklist below to prepare a compatible code and database pair.

## Features and workflow

| Area | What operators can do |
| --- | --- |
| Dashboard and navigation | Open permitted modules from the dashboard and top navigation. On mobile, use the navigation drawer and the page title in the top bar. The drawer locks background scrolling. The dashboard omits company tiles for the workspace switcher and visible record totals. |
| Companies | Search companies, manage status and the default company, and maintain existing sub-company records. In the local update, Company Details has name, short name, type, status, and parent company. Contacts & Emails holds repeatable titled phone and email records. Addresses holds titled lines, country, city, postal code, and primary address. Owners / Representatives supports linked or manually entered owners, designation, and ownership percentage. Tax & Registrations holds NTN, STRN, WeBOC ID, and PSW ID. |
| Countries and cities | Maintain country display order and associated cities. Country selection filters city lookups across banking and addresses. |
| Banks, branches, and officers | Maintain banks, city-linked branches, and officers linked to Person records. Officer assignments can be bank-wide or branch-specific. Bank, branch, city, and country selections must agree. |
| Person Information | Maintain identity, tax details, notes, status, contacts, and private profile, signature, and identification documents. Mark the current person as an employee in Personal Details and select multiple active employee types. The separate employee details API supports salary. |
| Business roles per company | Use Company Associations to assign a person multiple business roles in a company and record an opening amount per role. `person_classifications` remains the underlying assignment table. Business Roles is the visible master-data name. |
| Marka | Maintain a manually entered code, description, and status. Link multiple existing codes in each person's Marka tab. |
| Person Bank Accounts | In the local update, this tab provides the existing account API through an inline table. A record links to a Person and bank branch and stores account title and account number or IBAN. A legal account company and one of its saved addresses are optional. Changing the company clears the address selection. |
| Users | Create and edit an account with a username, password, role, and portal company grants. Search **Link To** for an eligible Person without a linked account. An account can be unlinked or made Inactive. Disabling the account preserves audit attribution. |
| Roles and audit | Super Admin manages role names and the View, Create, Update, and Delete permission matrix by module. Audit History records actor, action, entity, and redacted changes. The Admin seed profile excludes audit and role-management permissions. |

The company form saves the parent company record before adding rows for contacts, emails, addresses, or owners. The local migration copies existing single phone and address values into primary rows and retains the legacy columns. Each company can have one active primary phone, one active primary email, and one active primary address. Parent-company links reject cycles. Existing sub-company rows remain in `sub_companies`, while Parent Company links two `companies` records. A linked owner takes Name and CNIC from the Person record when saved, and active ownership percentages cannot exceed 100% in total. WeBOC and PSW store identifiers only.

Most record pages use a searchable master list and a detail panel with Back, New, Edit, Save, Cancel, and Delete as permitted. The top and bottom action bars keep actions reachable on long forms. Mobile actions use labeled icons, and wide detail tables scroll within their own panels. `Ctrl/Cmd+N` creates a record, `Ctrl/Cmd+E` edits the selected record, and `Ctrl/Cmd+S` saves the active form or row. In shared inline tables, click a column heading or Add Row to start a row, use arrows to move between cells where applicable, and use Escape to cancel. Save and Cancel are explicit, and drafts retain the loaded record version. [Repository interaction rules](../AGENTS.md)

The interface uses Title Case labels, Active and Inactive status text, Tahoma with fallbacks for body text, and a distinct identifier font for codes and account numbers. The local palette uses dark green navigation with mint accents. Supported business input is normalized to uppercase on save, including usernames, email addresses, and website URLs. Passwords retain their exact case. Preserve leading zeroes in business identifiers. Monetary values use decimal strings, and opening amounts do not post to a ledger. Date-only values stay date-only, with UTC timestamps and Asia/Karachi display conventions.

## Authentication permissions and company context

- Sign-in uses an active username, password, and role. Laravel Fortify handles authentication and rate limits, and Sanctum protects the same-origin API. Public registration, self-service password changes, password resets by email, and two-factor enrollment are disabled. Authorized administrators manage account credentials. Account and role changes revoke affected sessions. The last active Super Admin is protected from deactivation or demotion.
- **Super Admin** has full permissions and access to the role matrix. **Admin** manages business records and assignable accounts. Super Admin users and the Super Admin role are excluded from Admin's user-management views and choices. Business records remain visible under the caller's module permissions even when created by a Super Admin.
- **USER** has View for Companies, Countries/Cities, and Banks. It has full permissions for People, Company Associations, Employee Details, Documents, Person Bank Accounts, and Marka. Business Roles and Employee Types master pages and Administration are excluded. The Person workflow can still use business role and employee type reference lookups with the relevant Person section permissions. The checked-in demo role profiles define Super Admin, Admin, and USER. Confirm any additional profiles such as Read-only or Result against the target database before assigning them. [Role seed profiles](../database/seeders/client-demo-roles.json) and [USER permission defaults](../database/seeders/UserRoleSeeder.php)

| Company relationship | Meaning and storage |
| --- | --- |
| Portal Company Access | `company_user` grants active workspace choices in the switcher. The app selects the granted default company if available, then falls back to the first grant. An account can have no grants. The active default company is preselected when assigning portal access for a new account. |
| Legal account company | `person_bank_accounts.company_id` is the company that legally holds the account. `company_address_id` references one of that company's saved addresses. These fields are part of the local update. |
| Person business role per company | `person_companies` identifies the association, and `person_classifications` assigns the business role and opening amount for that association. |

Portal grants control workspace choices. The current `Access::scope()` passes business queries through, so records the user has permission to view are available across companies. Company filters in workflows such as Person Associations apply only where explicitly selected. Parent relationships, module/action permissions, active reference records, and foreign keys still govern reads and writes. Company-wide data isolation would require a separate access design before using this deployment as a multi-tenant system. [Access rules](../app/Modules/Access/Access.php) and [Session API](../app/Http/Controllers/Api/SessionController.php)

## Developer orientation

The workspace uses PHP 8.4 with Laravel 13, Fortify 1, Sanctum 4, MariaDB 10.11, React 19, TypeScript, Tailwind CSS 4, Vite 7, TanStack Query/Table, React Hook Form, Zod, and bundled Font Awesome icons. Composer and npm lockfiles are the source for exact dependency versions. The React app and Laravel API are served under the same origin. A production server can use compiled assets without Node.

| Location | Start here for |
| --- | --- |
| `routes/web.php` and `bootstrap/app.php` | Web shell, versioned API routes, middleware, and error responses. |
| `app/Modules/Shared/EntityRegistry.php` | Entity fields, references, parent relationships, and permission modules. |
| `app/Modules/Shared/RecordService.php`, `DomainRules.php`, `VisibleRecords.php` | Validation, writes, reference visibility, versions, and business invariants. |
| `app/Modules/Shared/ApiContracts.php` and `app/Console/Commands/GenerateContracts.php` | Supplemental API schemas and generation of TypeScript contracts, field map, and OpenAPI. |
| `app/Http/Controllers/Api` and `app/Modules/Access` | Session, records, account and role administration, documents, employee details, and per-company Person roles. |
| `app/Models`, `database/migrations`, `database/seeders` | Storage, relationships, migrations, roles, demo data, and test fixtures. |
| `resources/js/app.tsx`, `resources/js/pages`, `resources/css/app.css` | App routes and permission gates, screens including `CompanyProfile.tsx`, and shared styling. |
| `resources/js/components` and `resources/js/lib` | Master/detail lists, inline tables, reference selectors, dirty-form handling, shortcuts, and API/session helpers. |
| `tests/Feature`, `tests/frontend`, `tests/e2e` | MariaDB API tests, Vitest interaction tests, and Playwright browser flows. |

`/api/v1/{entity}` lists and creates root records. Child writes use `/api/v1/{parentEntity}/{parentId}/{entity}[/{id}]` so the server verifies its parent. Lists support search, status, sorting, and pagination, with 100 rows per request at most. `context=management` includes inactive records where authorized. Reference lookups apply active-record and required-parent checks. Update and delete requests carry the currently loaded version. On `409`, reload and review the newer record before resubmitting. `422` identifies validation errors, `403` identifies denied actions, and `404` can indicate a missing record or wrong parent. Most record deletions are soft deletes, and references can require deactivation instead.

Business record writes use transactions and a shared record lock for changes that affect defaults, primary rows, or linked records. A separate lock protects administration writes. Audit entries are append-only through the application, with sensitive values redacted. Authorized document uploads accept JPEG, PNG, and WebP up to 10 MiB and 16 megapixels, and the server re-encodes images as PNG. PDFs up to 10 MiB are accepted for identification documents and served as attachments.

The frontend obtains its session token from `GET /csrf-token`, sends `X-CSRF-TOKEN` for writes, and refreshes and retries a rejected write once on `419`. The helper also supports the Laravel `XSRF-TOKEN` cookie. Signed-out pages avoid background session polling. `/api/v1/session` supplies effective permissions, entity definitions, and allowed workspace choices. [API reference](API.md), [generated OpenAPI](openapi.json), and [field map](FIELD-MAP.md)

## Run locally

Use PHP 8.4 with PDO MySQL, GD, mbstring, XML, curl, OpenSSL, fileinfo and zip, Composer 2, Node 22.12+, and MariaDB 10.11. On the development Mac, Node 22 can be selected with `export PATH="/usr/local/opt/node@22/bin:$PATH"` if it is installed there. `compose.dev.yaml` binds the development database to `127.0.0.1:3311` and the test database to `127.0.0.1:3312`.

1. Run `composer install` and `npm ci`. For a fresh checkout, copy `.env.example` to `.env`, review the database settings, and run `php artisan key:generate --no-interaction` once. Preserve existing environment files and app keys on established installs.
2. Start Docker. On this Mac, start Colima if needed. Start existing `cargocore-mariadb` and `cargocore-mariadb-test` containers if present. For a fresh environment, use `docker compose -f compose.dev.yaml up -d` instead. Keep each service on its intended port and volume.
3. Run `php artisan migrate --seed --no-interaction` for a new development database. For an existing database, check `php artisan migrate:status --no-interaction` and apply pending migrations. For an initial administrator, use `php artisan erp:create-admin` and enter the password privately when prompted.
4. Run `php artisan serve --host=127.0.0.1 --port=8011 --no-interaction`. Use `npm run dev` in another terminal for Vite on `127.0.0.1:5174`, or run `npm run build` to serve compiled assets. If Vite is stopped and `public/hot` is stale, remove that marker before opening the compiled app. Open `http://127.0.0.1:8011`.

`DatabaseSeeder` installs roles, permissions, and reference types. `DemoSeeder` provides optional sample business data for development. `E2ESeeder` uses test credentials and checks the dedicated test environment. `ClientDemoSeeder` requires an empty local or testing business database and demo passwords supplied securely through configuration. The existing demo uses ALI as Admin with a linked Person record, and SAATH as Super Admin without a Person link. It contains synthetic active and inactive companies, people, banking and reference records. Store login credentials separately from this handoff.

## Build and verification

After editing `EntityRegistry` or supplemental API schemas, run `php artisan erp:contracts --no-interaction` and review the generated `docs/openapi.json`, `docs/FIELD-MAP.md`, and `resources/js/lib/contracts.generated.ts` together. Run `vendor/bin/pint --dirty --format agent` after PHP edits and `npm run build` after frontend edits. Keep `public/build/manifest.json` with the matching hashed assets for cPanel releases.

1. Set up `.env.testing` from `.env.testing.example` and generate a test app key if needed. Confirm it targets `cargocore_test` on port `3312` before running database tests. Playwright resets this database, and PHPUnit uses the same service. Run those suites in sequence.
2. Run `php artisan test --compact`, `npm test`, and `npm run build`. Install Playwright Chromium with `npx playwright install chromium` if needed, then run `npm run test:e2e`. The browser suite starts its own Laravel instance on port `8012` and logs in with a generated test password. Its screenshots and session state are private test artifacts.
3. For the local feature changes, the previous verification covered 23 selected PHP tests, 25 frontend tests, and three Company Management browser tests across desktop, mobile, and bank-account address selection. The seven Company Management API tests passed again after partial-update validation was tightened. The subsequent palette build passed and the six selected dashboard/navigation browser cases passed across the initial run and the rerun of one corrected test selector. These are local results. Confirm the release on its target environment before client acceptance. [Earlier verification record](VERIFICATION.md)

## cPanel release and deployment

1. Agree on the revision and database migration state. For the pending local release, review and commit the Company Management and palette changes together with matching generated contracts and build assets. Produce the cPanel code bundle and test it against an isolated copy of the target database. The existing November 6 packages can be identified by their filenames and timestamps under `storage/app/private/client-demo/`.
2. Back up the existing database, private files, environment configuration, and current release. For the first demo installation only, import `cargocore-client-demo.sql` into an empty demo database via phpMyAdmin. The dump includes table creation and data. Treat the supplied SQL as a database snapshot. To rebuild a fresh demo database, migrate a disposable database, run `ClientDemoSeeder` with privately supplied demo passwords, verify it, then export a new SQL snapshot. Use migrations for upgrades to a populated database.
3. Apply `2026_11_06_175022_extend_company_management_details.php` before serving the updated code against an existing installation. The migration adds company hierarchy and tax fields, child tables, and the bank-account company/address references. On a terminal-free cPanel account, prepare and validate the matching database upgrade in staging and coordinate its application with the hosting operator. The current SQL dump does not deliver this upgrade by itself.
4. Point the domain document root to the release's `public/` directory. The root `.htaccess` provides an Apache-compatible fallback when cPanel points to the project folder, provided rewrite rules and overrides are honored. A public directory listing is a document-root or rewrite problem. Keep directory indexing off and private application files outside the served directory.
5. Supply production PHP dependencies and matching compiled frontend assets with the release when cPanel has no terminal. A Git checkout alone will typically lack `vendor/` and `.env`. Keep `public/hot` out of the release. Give PHP write access to `storage/` and `bootstrap/cache/`.
6. Use `deploy/cpanel.env.example` as the template. The production environment needs the canonical HTTPS URL, `APP_ENV=production`, `APP_DEBUG=false`, a private persistent `APP_KEY`, and the cPanel database credentials. Sessions and cache use database tables, session cookies use HTTPS, and `QUEUE_CONNECTION=sync` allows the demo to operate without a worker. The previously prepared private `.env` is in the local demo artifact folder. Transfer configuration and credentials privately.
7. Confirm HTTPS, `/up`, static asset loading, and sign-in on desktop and mobile. Verify ALI cannot see Audit History, Roles management, or Super Admin accounts and that SAATH can. Check portal company choices and the default, Company Management saves, and a Person Bank Account address lookup. Record the deployed commit, backup reference, and migration state. [cPanel environment template](../deploy/cpanel.env.example) and [root rewrite rules](../.htaccess)

## Operations recovery and next release

- `php artisan erp:health --no-interaction` checks the database, private storage, and failed jobs. `/up` checks application reachability. `php artisan erp:verify-files --no-interaction` checks current private documents against stored hashes after a restore. `erp:database-grants` produces table grants for a DBA to review, including append-only runtime access to audit events. `erp:export-demo-roles` exports role profiles without account or business records. `erp:uppercase-data` changes existing text and versions, so treat it as a planned data operation.
- Protect database dumps, credentials, `APP_KEY`, private files, and backups as one recovery set. Documents use authorized download routes with private storage and immutable replacement paths. Removed or replaced bytes are retained for history. Use a verified database and file backup together when restoring. Keep logs and cleanup schedules appropriate to the hosting setup.
- If a mobile or desktop login reports a CSRF mismatch, check the canonical HTTPS hostname, `/csrf-token`, browser cookies, and database session writes. Confirm the configured `APP_KEY` and session settings match the running release and that cached config reflects them. A missing asset or a browser trying to reach Vite on `5174` in production points to the asset manifest, release files, or a stale hot marker. Referenced-record deletion errors and version conflicts require reviewing the relationship or reloading the record.
- The optional Windows deployment uses Apache behind Caddy, MariaDB, PowerShell tasks, and Restic. The runbook covers certificate renewal, firewall/NAT, service identity, alert delivery, backups, and timed recovery. Its targets are at most 24 hours of data loss and four hours to restore service. Commissioning and timed recovery need evidence from the actual server. [Windows deployment and recovery runbook](DEPLOYMENT.md)
- Before the next demo release, prepare current cPanel assets and a migration path, test deployment and restore in staging, verify custom role profiles with the client, and record the resulting revision. Keep future shipment operations, transaction posting, ledger, statements, and bulk imports as separate business workflows with their own rules.

Some older repository notes describe a previous milestone, including MFA, tenant filtering by portal grants, and the early scope of Marka. Use this handoff, current code, tests, and generated contracts for the present behavior. [Setup README](../README.md), [architecture notes](ARCHITECTURE.md), and [codebase index](CODEBASE-INDEX.md)
