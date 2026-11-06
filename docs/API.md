# CargoCore API contract

The checked-in [OpenAPI specification](openapi.json) is generated from the same registry that validates forms and supplies frontend metadata. Run `php artisan erp:contracts` after changing the registry. Matching TypeScript contracts are in `resources/js/lib/contracts.generated.ts`. The browser uses the same-origin session API; these are not public anonymous CRUD endpoints.

## Authentication

1. GET `/sanctum/csrf-cookie` with credentials enabled.
2. POST `/login` with `username`, `password` and optional `remember`. Include the decoded `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on every write. JSON Accept header required.
3. GET `/api/v1/session` for identity, company choices, capabilities and form metadata. Active users can enter the workspace immediately after password sign-in.
4. POST `/logout` ends the session. Public registration and email password reset are disabled. Authorized administrators reset subordinate account passwords through the users API; the assigned password works directly at the next sign-in.

Two-factor setup/challenge endpoints and self-service password changes are disabled. Passwords and authentication secrets are excluded from person/user responses. Account changes and administrator password resets revoke the target account's existing sessions.

## Masters

Root resources: `companies`, `countries`, `banks`, `people`, `employee-types`, `business-types`, `markas`.

| Parent | Child |
| --- | --- |
| companies | sub-companies |
| countries | cities |
| banks | branches, officers |
| people | contacts, accounts, associations |
| associations | classifications |

GET/POST `/api/v1/{resource}` lists/creates root records. GET/PUT/PATCH/DELETE `/api/v1/{resource}/{id}` reads/updates/deletes root records. Children must be written through `/api/v1/{parent}/{parentId}/{child}[/{id}]`; parent mismatch returns 404. Root GET child routes support scoped lookups with identical ancestor/module authorization. Updates are complete section submissions, including required fields, rather than arbitrary JSON Merge Patch.

List query: `search`, `status` (`1`, `0`, empty), `sort` (allowlisted persisted field), `direction` (`asc`, `desc`), `page`, `per_page` (1–100). Default ID order, stable ID tie-breaker. Responses: `{data: Record[], meta: {current_page,last_page,total,per_page,from,to}}`. Search is literal substring, including escaped SQL wildcard characters. Child filters use their parent FK; branches also accept country/city, officers accept branch, people accept `company_id` and/or `business_type_id`. Unassigned company filters are denied.

Add `position_of={id}` to the same list query to get `{navigation:{first,previous,next,last,position,total}}`. It uses the same scoped search/filter/sort across every page. Missing neighbors are null; a record outside that filtered set returns 404.

Every record carries `version`. Send it for update/delete. Stale edits return 409; fetch the current record, review it and resubmit. Record creation returns 201 `{data: Record}`; updates return 200; successful soft deletion returns 204. Referenced records must be deactivated instead. Soft-deleted references remain protected for history. Generated codes are immutable; city and MARKA codes can be supplied on creation. IDs, CNICs and account numbers are strings where business meaning requires leading zero preservation. PKR amounts are decimal strings, never floating point. Unknown input keys are excluded.

Bank account writes contain `bank_id`, `country_id`, `city_id`, `bank_branch_id`, `account_number`, `iban`, `account_title`, `status`. The bank/country/city fields are validated against the branch and then derived from that relationship on read. Officer assignments reference `person_id` and an optional branch belonging to the parent bank. Associated person personal fields are not embedded in officer responses.

POST `/api/v1/associations/{id}/classifications/batch` accepts `{items:[{business_type_id,opening_balance,status},...]}` (1–30). The transaction is atomic; each classification retains its own opening amount. Duplicate classifications reject the whole batch.

## Employee details and files

GET `/api/v1/people/{id}/employee` returns `{data: EmployeeProfile|null, eligible:boolean}`. PUT accepts `{salary: string|null, type_ids:number[], version:number}`; use version 0 for first creation. At least one active Employee classification is required to edit. Existing salary/classifications remain readable after that business classification is deactivated. Permissions for employee details are separate from person permissions.

GET `/api/v1/people/{id}/documents` returns `{data:Document[]}`. POST multipart to the same path creates; POST multipart to `.../documents/{documentId}` replaces. Fields: `kind` (`profile`, `signature`, `identification`), `document_type`, `document_number`, `expires_on` (YYYY-MM-DD), `file`, and `version` on replacement. Maximum 10 MiB, 16 megapixels; JPEG/PNG/WebP are re-encoded to PNG, PDF accepted only for identification. Replacement preserves the document kind and writes a new immutable file path. DELETE requires version. Only one current profile image/signature per person.

GET `.../documents/{documentId}/download` authorizes both person/document access. `?inline=1` renders images only. Other files download as attachments with private no-store headers. Paths/hashes are never exposed. Removed/replaced bytes remain private for historical recovery; plan storage capacity and retention before a future purge feature.

## Administration

GET `/api/v1/users?search=&person_id=&page=` returns paginated manageable users. POST creates; PUT `/users/{id}` updates. Fields: name, username, optional email/person_id, role_id, company_ids array, status boolean, password/password_confirmation (required on create, optional reset), version on update. Responses exclude passwords/secrets and include role_name, person_name and company_ids. Changes revoke the target's sessions. User removal is implemented as disable, preserving audit attribution.

GET `/api/v1/roles` returns `{data:Role[],permissions:string[]}`. A role includes its permission records. Non-Super Admin callers with users.view receive only assignable subordinate roles and an empty permission-definition list. POST/PUT `/roles[/{id}]` require Super Admin and accept name, status, permissions string[], version on update. Role removal uses deactivate. Super Admin always has all permissions; system roles cannot be renamed/disabled. Disabled roles revoke effective access. Permission definitions are code-owned.

GET `/api/v1/audit` supports search, entity, action, user_id, company_id and page. Returns 25 events/page with actor, timestamp, entity, record_id, company_id and redacted before/after changes. Non-Super Admin users cannot read other account/role administration events, nor events from unassigned companies. No mutation endpoint exists.

GET `/api/v1/dashboard` returns permitted master counts, recent people, company summaries and permitted audit activity. GET `/up` is a minimal process health response; the operator-only `erp:health` CLI checks DB/private storage/failed jobs and optionally backup freshness.

## Failures

JSON errors contain `message`, a stable `code` where supplied, and field-keyed `errors` for validation. 401 unauthenticated; 403 permission denied; 404 absent/outside scope; 409 stale version or concurrent constraint conflict; 419 CSRF/session expiry; 422 field or business rule validation; 423 password/MFA readiness gate; 429 throttled; 500 internal failure. Production responses hide stack traces. Retry GETs safely; review conflicts rather than blindly retrying writes.
