# CargoCore ERP

A connected ERP foundation built with Laravel 13, PHP 8.4, React 19/TypeScript and MariaDB 10.11. Companies, people, banking, geography, employee/business classifications, MARKA, access control and audit history share one relational database and a same-origin web application.

## Local development

Requirements: PHP 8.4 with PDO MySQL, GD, mbstring, XML, curl, OpenSSL and zip; Composer 2; Node 22.12+; Docker for the provided MariaDB services (or a separate MariaDB 10.11 instance).

```sh
composer install
npm ci
cp .env.example .env
php artisan key:generate
# Skip this if the CargoCore MariaDB containers already occupy 3311/3312.
docker compose -f compose.dev.yaml up -d
php artisan migrate --seed
npm run build
php artisan erp:create-admin
php artisan serve --host=127.0.0.1 --port=8011
```

Open **http://127.0.0.1:8011**. The compiled SPA and API are served together; no Node server is required. On this development Mac, use `PATH=/usr/local/opt/node@22/bin:$PATH` before npm commands if the system Node is older. Existing development containers may be named `cargocore-mariadb` and `cargocore-mariadb-test`; do not start competing Compose services on their ports. Restart those containers with `docker start cargocore-mariadb cargocore-mariadb-test`.

The bootstrap command prompts privately for a password and creates no default password. Users sign in directly with the password assigned by an authorized administrator. Account creation and password resets are managed in Administration. Public registration is disabled.

For frontend hot reload, run `npm run dev` alongside Laravel. For background development jobs, run `php artisan queue:work --tries=3` and `php artisan schedule:work` in separate terminals. Stop Vite cleanly before using compiled assets; a stale `public/hot` file points the page at a stopped Vite server.

Reference seeding creates only system roles, permissions and the agreed employee/business types. Optional illustrative business data (no accounts or reusable passwords):

```sh
php artisan db:seed --class=DemoSeeder
```

DemoSeeder refuses production. Production must start with `DatabaseSeeder`, never with development/test data.

## Implemented workflows

- Company master, default-company rules, linked sub-companies and repeatable contacts.
- Country/city master with dependent selectors throughout banking.
- Bank/branch master and officers linked to existing or inline-created people.
- Central person master with contacts, protected documents/images, bank accounts, company/classification opening amounts, global salary/employee types and account-administration shortcuts.
- Employee/business type masters and standalone MARKA codes.
- Scoped user management, Super Admin role matrix, MFA, session revocation and redacted audit history.
- Search, allowlisted sorting, pagination, filtered record navigation, explicit Save/Cancel, optimistic version conflicts and unsaved-change guards.

English interface, PKR decimal amounts, Asia/Karachi display times and UTC persistence. Dates of birth/joining/expiry are date-only values. Opening amounts are captured without ledger posting or debit/credit inference. MARKA/customer links, shipments, transactions and statement/import workflows remain outside this milestone.

## Verification

Use the dedicated **destructive test database**, never the local business database. `.env.testing.example` and `phpunit.xml` target `cargocore_test` on 3312. The Playwright setup refuses a differently named database, but still resets all data in that test database. Run backend and browser tests sequentially because they share it.

```sh
cp .env.testing.example .env.testing
php artisan key:generate --env=testing
php artisan test --compact
npm test
npm run build
npx playwright install chromium
npm run test:e2e
php artisan erp:health
vendor/bin/pint --dirty --format agent
```

Browser tests start a separate Laravel process on 8012, create a random test-only password, complete a real TOTP login, and exercise all module families plus mobile navigation. Browser screenshots/reports and authentication cookies live in ignored `test-results/`; treat them as private local artifacts.

## Project map

| Location | Purpose |
| --- | --- |
| `app/Modules/Shared` | Form/entity contracts, transactional writes, integrity rules, audit redaction |
| `app/Modules/Access` | Gate authorization and company query scopes |
| `app/Http/Controllers/Api` | Versioned master, person, file and administration APIs |
| `app/Models`, `database/migrations` | Relational persistence, foreign keys and business-code separation |
| `resources/js/components` | Shared forms, tables, selectors, modal and master/detail components |
| `resources/js/pages` | Person tabs, modules, administration, dashboard and security |
| `deploy/windows` | On-prem gateway, database, installation, update, backup and task configuration |
| `tests` | MariaDB feature tests, frontend interaction tests and browser journeys |

See [API contracts](docs/API.md), [field mapping](docs/FIELD-MAP.md), [architecture](docs/ARCHITECTURE.md), and the [Windows deployment and recovery runbook](docs/DEPLOYMENT.md). Regenerate machine contracts with `php artisan erp:contracts`.

Windows commissioning requires the actual public IP, server/router access, service identity and backup destination. Local tests do not certify that external infrastructure, public certificate renewal, service restarts or the four-hour recovery target.
