# Local verification record

Verified on 4 November 2026 in the development workspace. The application is served at http://127.0.0.1:8011; MariaDB development and isolated test services bind to loopback ports 3311 and 3312. Production credentials are not seeded.

| Check | Result |
| --- | --- |
| PHP feature/unit suite on MariaDB 10.11 | 24 tests passed, 283 assertions |
| Frontend interaction/validation/decimal-format tests | 6 tests passed |
| Chromium browser journeys | 10 passed, including real password/TOTP login, all master families, person account/classification/salary/document writes, stale-edit reload and mobile navigation |
| TypeScript check and Vite production build | Passed |
| Composer security audit | No advisory found |
| npm dependency audit | No vulnerabilities found |
| OpenAPI 3.1 schema validation | Passed |
| Laravel route cache compilation | Passed; local route cache then cleared |
| `erp:health` | DB, private storage and failed-job checks passed |
| PHP formatting | Laravel Pint applied |
| Caddy gateway template | Validated with Caddy 2.11.7 using a documentation-only IP; no public certificate requested |
| MariaDB recovery exercise | Transactional dump restored into a separate disposable MariaDB 10.11 container; all 34 table checksums matched; disposable container removed |
| Document recovery verification | Test proves valid files pass and missing/corrupted files fail; `erp:verify-files` available to operators |

The browser suite uses a random test-only password, test-only MFA secret and an isolated database. Its setup checks the resolved environment/database before reset. Screenshots and session state are ignored local artifacts, not release assets. The local preview includes illustrative opt-in demo business data; production seeding creates reference classifications and system roles only.

These checks establish the local application behavior, not acceptance of the client's infrastructure. Still to be executed on the Windows server: PowerShell installation/task behavior, service restart, real public-IP certificate issuance/no-SNI selection/automatic renewal, firewall/NAT and LAN access, encrypted backup destination access and operator alert delivery, full file-and-database restoration using production recovery keys, and a timed restore proving the 24-hour RPO/four-hour RTO targets. Use the commissioning checklist in DEPLOYMENT.md and record actual evidence before go-live.
