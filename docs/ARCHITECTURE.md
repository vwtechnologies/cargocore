# Architecture and extension points

Laravel serves the React SPA and session-authenticated `/api/v1` endpoints from the same origin. Sanctum uses cookie sessions; Fortify handles username/password authentication; authorized administrators create accounts and reset passwords. There is no public signup, bearer-token UI, Node production server or Redis dependency. Database tables provide sessions, cache and jobs. All persistent timestamps are UTC; browser display uses Asia/Karachi.

`EntityRegistry` supplies module ownership, parent relationships, field controls, validation and contract generation. `RecordService` validates input, checks authorization and parent identity, acquires transaction locks, rejects stale versions, applies `DomainRules`, writes the record and audit event, and returns safe attributes. Unknown write keys never enter persistence. Immutable business codes are generated from allocated numeric IDs; database unique constraints remain the final authority. MariaDB uniqueness/default constraints complement application rules.

Company access is a user-company join. Company records, sub-companies and person-company associations/classifications are scoped at query time. Person identities and reference masters are shared. Shared contacts, salary, employee classifications, accounts and documents require their own module permissions; company association membership does not duplicate or automatically hide the shared person identity. Each user has exactly one system role. Permission definitions are in code, and only Super Admin may assign roles' permissions. Admin subordinate management checks both permission subsets and company subsets.

## Relationship map

- Company → sub-companies; user ↔ company through explicit membership.
- Country → cities → bank branches; bank → branches and officer assignments.
- Person → contacts, documents, bank accounts, company associations, optional user.
- Bank officer → existing person, bank, optional branch from that bank.
- Person bank account → branch; bank/city/country are derived and validated from that branch.
- Person company association → one company; unique `(person_id,company_id)`.
- Person classification → association and business type, unique pair; opening PKR amount belongs here.
- Person → at most one employee profile → many employee types; salary belongs to that profile.
- MARKA is a standalone code/description/status record without customer or shipment relationships.

Foreign keys restrict physical deletion. Business records are soft-deleted only after dependency checks, including historical soft-deleted references. Deactivation retains references. The last enabled Super Admin cannot be disabled/demoted. There is one active default company once companies exist, and at most one active default sub-company per parent. Default replacement is atomic.

## Concurrency and scale

Every editable record includes an integer version. A stale version returns 409 instead of silently overwriting another user's changes. Transaction locks serialize master writes/default changes; a separate lock serializes access administration. This favors correctness for an initial multi-user on-prem deployment. If sustained writes become a bottleneck, replace the coarse business lock with documented per-aggregate locks while preserving concurrency tests and unique constraints. Database window functions support filtered navigation without materializing all records in PHP.

Lists use server-side paging, allowlisted sorting and stable ID ordering. Reference controls return at most 100 matches and instruct users to refine search. TanStack Query caches server responses and invalidates affected data after successful writes. React Hook Form and Zod provide early validation; Laravel remains authoritative. Parent-dependent selectors clear incompatible values, and the backend validates the complete chain independently.

## Files and audit

Files live under `storage/app/private`, outside Apache's public document root. Downloads always pass person/document authorization. Images are decoded and re-encoded; PDFs are downloaded, not rendered inline. Every replacement writes a new UUID path, so database snapshots remain consistent with subsequent file copies. Removed/replaced bytes are retained for recovery; no purge job is enabled in this milestone. Failed writes do not leave a valid record pointing at an unpersisted file.

Audit records contain actor, UTC time, entity, action, record/company context and redacted changes. Credentials, MFA secrets, account/identification values, salary and opening amounts are excluded or redacted. There is no audit mutation API. Production application grants allow only SELECT/INSERT on audit_events; migration credentials are separate. Security administration events for other accounts/roles are restricted to Super Admin.

## Adding future modules

Introduce additive migrations with foreign keys to existing companies, people, banks, branches and cities. Define permissions in EntityRegistry, regenerate contracts, add scoped policies/services and tests, then expose the workflow through the shared shell. Finance must define ledger/accounting semantics separately before interpreting opening amounts. Imports should resolve existing master IDs and apply the same domain services instead of bypassing validation. Cargo operations may associate MARKA only when that business relationship is specified. Do not repurpose the person master into duplicated vendor/customer/employee tables.
