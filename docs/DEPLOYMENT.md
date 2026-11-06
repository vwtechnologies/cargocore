# Windows deployment and recovery runbook

This package targets a maintained 64-bit Windows Server, XAMPP Apache/PHP 8.4 and MariaDB 10.11. The current [XAMPP download catalogue](https://www.apachefriends.org/download.html) includes that PHP/MariaDB combination; verify installed versions and security updates before commissioning. The local development/test host is macOS, so the Windows tasks, firewall, NAT and live public certificate lifecycle require execution on the client's server.

## Required parameters and tools

Obtain the public static IP, router administrative access, LAN addressing/NAT-loopback support, operator email, Windows service identity, backup UNC path, backup retention/ACL policy and recovery-key custodian. These are deployment parameters, not hard-coded application configuration.

Install PHP extensions PDO MySQL, GD, mbstring, XML, curl, OpenSSL, zip and fileinfo. Configure PHP `upload_max_filesize=10M`, `post_max_size=12M`, `memory_limit=256M`, `expose_php=Off`, `display_errors=Off`, `log_errors=On`. Install Composer, Caddy with ACME profile support, and Restic. Build frontend assets on a development/build machine with Node 22.12+; Node is unnecessary on the server. Pin and retain installer/tool versions and hashes in the release inventory.

Paths below follow `deploy/windows/operations.example.json`. Copy it to an ignored `operations.local.json`, fill every field, and restrict it to operators. Paths to `mariadb-dump.exe`/`mysql.exe` vary by package; set them to actual installed binaries. Create dedicated service identities with log-on-as-service/batch permissions, no interactive administrator privileges, and required access to the backup share.

## Release preparation and database

1. Prepare a release with `composer install --no-dev --prefer-dist --optimize-autoloader`, `npm ci`, `npm run build`; package source, vendor and `public/build`. Exclude `.env`, test output, local secrets and node_modules. Keep an immutable previous release for rollback.
2. Place the release at `C:\CargoCore\current`. Create `.env` from `production.env.example`; set HTTPS IP URL, DB application credentials and a fresh APP_KEY using `php artisan key:generate`. Preserve APP_KEY permanently: encrypted MFA secrets and backup recovery depend on it.
3. Set MariaDB `bind-address=127.0.0.1`; install/start its Windows service. Execute a reviewed copy of `database.sql` as DBA with three unique generated passwords. Accounts are application (runtime), migration (schema/seed), backup (read/dump). Never expose 3306 or phpMyAdmin through the router.
4. Store migration credentials outside the web/app tree in `C:\CargoCoreSecrets\migration.json`: `{"username":"cargocore_migrate","password":"<generated>"}`. Restrict ACLs to deployment operators/service identity. The runtime `.env` retains only application credentials.
5. Run `Update.ps1 -ConfigPath ...\operations.local.json` to migrate/seed/cache using the migration identity. It seeds reference types only. Generate runtime grants with `php artisan erp:database-grants` and have DBA apply the output. This replaces broad database UPDATE/DELETE grants with per-table grants and makes audit_events append-only to the runtime account. Repeat after schema additions.
6. Run `php artisan erp:create-admin` interactively as a trusted operator; its password prompt is hidden. Sign in directly with the assigned password. No default account/password is shipped.

## Apache and public HTTPS

Run `Install.ps1` from an elevated PowerShell after filling production `.env` and operations config. It generates Caddy/Apache configs, validates Caddy, registers the gateway service/event source and opens Windows TCP 80/443. Review generated configs before service start.

Configure XAMPP Apache manually to **listen only on `127.0.0.1:8088`**. Remove/disable other Listen directives, public default virtual hosts, SSL listeners and XAMPP administration aliases. Enable rewrite and include the generated `httpd-cargocore.conf`. Its document root is exactly `C:/CargoCore/current/public`. Validate with `httpd.exe -t`, install Apache as an automatic service if absent, and restart it. Do not run the production app using Artisan's development server.

Caddy binds public 80/443 and proxies to loopback Apache. Configure the gateway service identity in Windows Services and give it write access to its certificate storage and log directory. Preserve its data directory across upgrades. Start the gateway service. Production secure cookies and Laravel trusted proxies (loopback only) derive HTTPS from Caddy's trusted forwarded headers.

The template explicitly selects Let's Encrypt's `shortlived` ACME profile. Public IP certificates are valid for 160 hours and require automated renewal. [Let's Encrypt documentation](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability), [Caddy TLS configuration](https://caddyserver.com/docs/caddyfile/directives/tls). `default_sni` supplies the public IP certificate selection for clients that connect without SNI; keep the Caddy service running continuously. Use staging ACME during setup to avoid production rate limits, then switch to the production directory for acceptance. Do not use an internal CA certificate for public acceptance.

Forward router TCP 80 and 443 to the server's reserved LAN address. Allow outbound DNS/HTTPS for certificate issuance/renewal. Block external access to Apache 8088, MariaDB 3306, Caddy admin 2019, SMB and all XAMPP management services. Windows RDP access should be limited to the approved administrative network/VPN. LAN clients use the same public IP URL; configure router hairpin NAT or an equivalent gateway route. DNS alone cannot rewrite an IP-literal URL.

Grant the Apache identity read access to code/vendor/public and write access only to `storage` and `bootstrap/cache`. Keep `.env`, source, upload storage and backup secrets outside public document root. Do not run `storage:link` for protected person documents.

## Scheduler, queue, monitoring and backups

Set Windows timezone to `Pakistan Standard Time` (application database timestamps stay UTC). Run `Register-Tasks.ps1` elevated, supplying the service account credential at its Windows prompt. Tasks run scheduler and queue every minute, backup daily at 02:00 PKT, health every 15 minutes. Database queue workers drain and exit, avoiding a permanent Node/Redis service. Set task/service automatic restart policies and test a full server restart.

Laravel daily logs retain 30 days; Caddy rotates access/runtime logs. Monitor Windows Application event source **CargoCore ERP**, task exit codes, `storage/app/operations/{backup,health}.json`, Laravel failed jobs and Caddy renewal errors. Health checks validate public HTTPS, certificate lifetime (alert under 48h), DB/private storage, failed jobs and backup age (under 24h). Configure your existing Windows Event Forwarding/monitoring system to alert an attended operator; writing a local event alone does not notify someone off-site.

Create `backup.cnf` outside the project with restricted ACLs:

```ini
[client]
user=cargocore_backup
password=<generated backup database password>
host=127.0.0.1
port=3306
```

Store a long random Restic repository password in `restic-password.txt`. Keep a separately protected offline recovery copy and the database recovery credentials. Initialize the repository once under the scheduled-task identity:

```powershell
$env:RESTIC_REPOSITORY = '\\BACKUP-SERVER\CargoCore'
$env:RESTIC_PASSWORD_FILE = 'C:\CargoCoreSecrets\restic-password.txt'
& C:\CargoCore\tools\restic.exe init
```

Run `Backup.ps1 -ConfigPath ...`. It creates a transactional MariaDB dump, copies immutable private files, APP_KEY-containing environment and composer.lock, encrypts the recovery set in Restic, retains 30 days (at least one snapshot), checks a sample of repository data, records status and removes plaintext staging files. Restrict staging ACLs and use disk encryption; it temporarily contains plaintext secrets. Use a separate backup device/share, not the application disk. Retain matching application release artifacts alongside the encrypted backup inventory. Avoid schema migrations during a dump. Perform a full Restic `check --read-data` periodically.

## Recovery drill and incident restoration

Targets are **RPO ≤24 hours and RTO ≤4 hours**; these are targets until a timed full Windows restore proves them. Schedule monthly drills and repeat after infrastructure/schema changes.

1. Record incident/drill start time, last successful backup and snapshot ID. For a drill, use an isolated host/database with no route to production. For an incident, stop scheduled jobs and put the damaged application in maintenance mode; preserve its disks/logs.
2. Run `Restore.ps1 -ConfigPath ... -Snapshot <id> -TargetDirectory C:\CargoCoreRestore\<new-directory>`. It refuses an existing target and verifies the decrypted recovery set. Find the printed directory containing database.sql, private, application.env, composer.lock and manifest.json.
3. Install the matching retained application release. As DBA, create an empty database such as `cargocore_restore_YYYYMMDD` with utf8mb4. Grant the migration account access to that new database. Import using the MariaDB client and a protected credential file (avoid PowerShell text pipelines, which may change SQL encoding):

```powershell
& C:\xampp\mysql\bin\mysql.exe --defaults-extra-file=C:\CargoCoreSecrets\restore.cnf --database=cargocore_restore_YYYYMMDD --execute="source C:/CargoCoreRestore/recovery/database.sql"
if ($LASTEXITCODE -ne 0) { throw 'Database import failed' }
```

4. Restore the original `application.env` as the isolated application's `.env`, retaining **its original APP_KEY**, but change DB_DATABASE/credentials and APP_URL for the drill. Set secure-cookie configuration to the actual drill HTTPS origin. Copy `private` to `storage/app/private`; apply service ACLs. Never run key:generate on restored data.
5. Clear config cache, delete restored sessions to force fresh authentication (`DELETE FROM sessions` using DBA), and run `php artisan erp:health`. Verify migrations match the release; do not migrate until recovery correctness is established. Query document metadata and verify every active path exists and SHA-256 matches; use `php artisan erp:verify-files`.
6. Log in with an existing authorized account, complete MFA, check counts and sample company/sub-company, country/city, bank/branch/officer, person contacts/accounts/associations/salary, documents and audit events. Confirm currency values, leading zeros and protected downloads. Validate private paths/admin URLs remain inaccessible.
7. For an incident, apply runtime grants to the restored DB, switch the production `.env`/release only after validation, rebuild config cache, resume services/tasks and run public Health.ps1. Retain the previous data set until reviewed. For a drill, record elapsed time, restored snapshot age, file verification and acceptance evidence, then remove the isolated recovery set securely according to operator policy.

## Updates and rollback

Before updating, take and verify a fresh backup; retain the old release. Stop queue/scheduler tasks during the update. Replace code/assets/vendor while preserving `.env`, storage and certificate data. Run Update.ps1; failures leave maintenance mode active. Apply updated table grants, restart Apache to clear opcode cache, restart tasks, run Health.ps1 and smoke-test login/MFA, one read/write and protected download. For additive compatible changes, restore previous code and rebuild caches; for incompatible schema changes, restore the prior database/files together from the snapshot using the recovery procedure. Never blindly run migration rollback against live business records.

## Commissioning acceptance record

Record date, operator, server/tool versions and evidence for: external IP HTTPS chain/SAN, no-SNI certificate selection, HTTP redirect, LAN hairpin access, actual automatic renewal, restart persistence, denied public DB/admin/source/upload access, Super Admin MFA/recovery, scoped user CRUD, backup success/failure alerts, repository key recovery, timed full restore and verified restored files. The application build cannot certify these checks without the actual client server and network.
