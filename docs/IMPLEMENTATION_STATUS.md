# Tokenly Implementation Status

Last updated: 2026-08-01

## Summary

- **Current phase:** Phase 5 — Customer application
- **Overall status:** in progress
- **Current target:** complete local prototype
- **Infrastructure status:** Supabase schema and a deployment-prototype QR/admin API path are applied; full Supabase-backed runtime adapters, Vercel project automation, GitHub publishing, and external integrations are deferred

This document records observed implementation, not intended scope. An item is complete only after its files exist and the relevant behaviour or command has been verified.

## Phase status

| Phase                              | Status      | Evidence                                                                                                                                                                                |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation                      | Complete    | Tooling configured; install, lint, typecheck, unit smoke, build, and development-server root request passed                                                                             |
| 2. Domain model                    | Complete    | Public domain contracts, versioned IndexedDB adapters, strict persistence boundaries, deterministic seed/reset/reseed, append-only audit handling, and combined validation are complete |
| 3. Wallet foundation               | Complete    | Ledger semantics, issuance, purchase, refund, adjustment, settlement calculation, concurrency controls, atomic rollback, and the full validation gate passed                            |
| 4. Authentication and onboarding   | Complete    | Local entry/runtime, role guards, one-time PIN setup, verification/lockout, onboarding, private capability boundaries, development tools, audit follow-up, and the combined gate passed |
| 5. Customer application            | In progress | Customer wallet/history, commerce, QR/scanner, and help slices are in implementation                                                                                                    |
| 6. Staff application               | Not started | No completion evidence recorded                                                                                                                                                         |
| 7. Vendor application              | Not started | No completion evidence recorded                                                                                                                                                         |
| 8. Administrator application       | Not started | No completion evidence recorded                                                                                                                                                         |
| 9. Responsive/accessibility review | Not started | No completion evidence recorded                                                                                                                                                         |
| 10. Final validation               | Not started | No completion evidence recorded                                                                                                                                                         |

## Foundation checklist

- [x] Initial workspace inspected.
- [x] `AGENTS.md` created.
- [x] Required initial documents created under `docs/`.
- [x] Architecture decision records started.
- [x] Future Supabase boundary and planning schema documented without configuring Supabase.
- [x] Next.js App Router application initialised.
- [x] Strict TypeScript, Tailwind, ESLint, and Prettier configured.
- [x] Vitest, React Testing Library, and Playwright configured.
- [x] Required application dependencies installed.
- [x] Shared design tokens and original Tokenly mark implemented.
- [x] Responsive role shells implemented.
- [x] Development server startup verified.
- [x] Production build verified.

Items may be updated by concurrent foundation work only after checking the resulting files/commands.

## Implemented features

Phase 1 provides the verified application/tooling foundation and shared
shells. Phase 4 account entry, PIN, onboarding, and development-tool workflows
are now implemented as described below; role applications remain pending.

Phase 2 now includes public domain contracts for accounts, customers, wallets, ledger entries, token issuances, evidence, vendors, products, orders, refunds, settlements, event settings, and audit logs. Normal account reads are credential-free, with PIN credential and lockout state isolated behind a purpose-specific repository contract. Append-only records expose no update or delete operation, and wallet contracts expose no stored balance or `setBalance` operation. Customer records also include local prototype access credentials for one-time claim QR distribution, stable private account links, and regeneratable vendor-facing wallet QR codes.

The local data composition now seeds a deterministic fictional event scenario
on first run and records schema/seed metadata. It includes the four required
development entry accounts plus additional customer, vendor, and staff
accounts; three vendor catalogues; manual issuance/evidence records; conserved
purchase and refund ledger groups; partial and full refunds; one manually
recorded settlement; and linked audit history. The development data facade is
environment-gated, targets only the fixed Tokenly database, and leaves
session/preferences untouched unless their scoped clearing is explicitly
requested.

Phase 3 now includes a canonical ledger-derived wallet balance calculation,
stable positive-integer, actor, idempotency, safe-range, and non-negative
balance errors, injected transaction identity/reference providers, and a
repository-transaction runner contract. Staff token issuance reloads the
authoritative staff, customer, wallet, event rate, ledger, and duplicate
reference state inside one unit of work. It validates local raster evidence,
uses the snapshotted rate with round-down conversion, requires an explicit
traceable acknowledgement for a reused normalized payment reference, and
atomically appends evidence, issuance, customer credit, and two audit records.

The Phase 3 integrity follow-up makes balance calculation independent of ledger
query order, validates direction/relationship/reversal semantics for every
ledger entry type, reserves prefix-free event-wide operation idempotency keys,
and rejects transaction-group collisions before writes. Deterministic seed and
local data semantics are now version `2`; version `1` data is preserved but
rejected until an explicit development reset/reseed.

Phase 3 also implements authoritative repository-price purchases, conserved
customer/vendor ledger pairs, full and partial administrator-recorded refunds,
reasoned administrator adjustments, and vendor settlement-period calculation. Every
value mutation rechecks actors, ownership, wallet relationships, current and
projected balances, idempotency, and transaction-group availability inside one
IndexedDB unit of work. Refunds reconcile prior refund records with their
paired reversal entries and preserve all originals. Concurrency tests prove
that simultaneous distinct-key purchases, refunds, and debit adjustments
cannot overdraw or over-refund, and audit failures roll back the value change.

Phase 4 local account entry now normalizes validated mobile input, resolves
only active repository accounts, appends an `account_entry` audit in the same
IndexedDB transaction, and returns a credential-free role destination.
Unknown, disabled, and incomplete records share one generic failure. Customer
destinations reflect persisted onboarding state; other roles route to their
documented application destinations.

The root client runtime initializes deterministic data on first mount, opens
the repository composition, validates the versioned account-ID-only
`localStorage` session, and re-resolves account and customer state from
IndexedDB. Repository handles remain private to the composition root; the
public context exposes only capability actions and credential-free read models.
Development account discovery and switching are independently environment
gated before repository access or audit/session writes. Runtime reloads are
serialized and close superseded or unmounted handles. It also exposes refresh,
sign-out, and safe reopen paths for reset/reseed. Reusable role guards cover
navigation decisions and the documented permission matrix. `/enter` is a
responsive React Hook Form/Zod flow with pending/error states, safe distinct
copy for account lookup versus runtime/storage failures, and a seeded local
super-admin username/password entry path. Tokeners do not sign in through
`/enter`; their access is QR/private-link only.

Phase 4 now includes an actor-bound `PinVerificationService` for active
customer and vendor accounts. It validates exactly four ASCII digits, derives
the seed-compatible prototype SHA-256 credential with browser WebCrypto before
opening the repository transaction, uses a fixed-shape comparison, and returns
generic failure or typed lockout results. Failed-attempt state and safe audit
records commit atomically; five concurrent failures cannot lose increments.
PIN setup/change persists only the derived credential and appends a safe
`pin_setup` audit. Production server-side password hashing, rate limiting,
recovery, and monitoring remain deferred.

Customer onboarding is implemented as a real four-step mobile-first route at
`/customer/onboarding`. Its service resolves the active customer from the
session actor, updates the persisted customer completion timestamp, and appends
an `onboarding_completed` audit in one IndexedDB transaction. Repeat completion
is idempotent, guided and development-skip methods remain traceable, the skip
is rejected unless development tools are explicitly enabled, and completion
refreshes the normal session before routing to `/customer`. Non-customer roles
are redirected to their own destinations and are never blocked by onboarding.

Development tooling now exposes only `/dev/role-switcher`. The role switcher
lists active seeded accounts and uses the normal runtime session API. The
browser-facing `/dev/data` route, command facade, and reset/reseed controls were
removed on 2026-07-29 so a visitor cannot destructively modify the local
prototype through the application. The remaining `/dev` route tree returns
not-found unless `NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS` is exactly `true`.

The Phase 4 audit follow-up keeps onboarding failures behind stable
customer-safe copy and catches failed runtime retries. Development navigation
exposes `aria-current="page"`, and fake-IndexedDB integration coverage proves
configured onboarding persistence plus rollback when its audit append fails.

The `/enter` surface now uses a clean two-panel layout with an official Big
Blue Floorball visual and linked partnership identity on the left, and the
minimal operational login on the right. QR mode below the login starts a visible
camera preview and accepts only same-origin one-time claim or private account
links. It rejects public wallet-payment QRs and external URLs. Lost private
access is recovered by having an administrator refresh the claim QR from
`/admin/tokeners`.

Phase 5 customer-access follow-up adds a local no-sign-up QR distribution and
recovery flow. Administrators can open `/admin/tokeners`, select a seeded
customer such as Lance Tan, and display a short-lived one-time claim QR. The
claim route `/claim/[claimCode]` marks the claim used and reveals the stable
private account route `/card/[privateAccessCode]`. The private account page
shows the ledger-derived balance, recent activity, and the vendor-facing wallet
QR. Regenerating the wallet QR changes only the customer `publicCode` used in
vendor-facing QR payloads, immediately invalidating older wallet QR codes while
keeping the private account link active. This remains local prototype bearer
link access, not production identity or Supabase Auth.

The Supabase CLI scaffold and executable initial relational schema migration
now exist under `supabase/`. The migration has been linked and pushed to the
hosted Supabase project `infiighwjaajxlwzwkgd`, creating the Tokenly relational
tables. A server-only health endpoint at `/api/supabase/health` verifies remote
table access with the configured server key. The application runtime still uses
IndexedDB repositories for product flows; remote database use in the UI requires
reviewed RLS policies, server-side transaction functions, and repository
adapters before any production claim.

The deployed QR distribution path now has a Supabase-backed prototype API for
admin tokener listing/creation, one-time claim QR refresh, private account page
loading, wallet QR regeneration, administrative token adjustments, and vendor
customer-wallet QR resolution. Tokeners still do not sign in; `/claim/[code]`
and `/card/[privateAccessCode]` use shared Supabase data so phone scans work
across devices. Admin and vendor API writes are gated by a signed prototype
cookie established by the local `AdminLance` and `Vendor1` password entry flow.
This is still prototype authentication, not Supabase Auth or production-grade
authorization.

Administrator tokener creation now accepts a Singapore mobile number instead
of NRIC/FIN. The API normalizes common `+65` and spacing formats to eight
digits, rejects invalid or event-duplicate numbers, and stores the number in a
new Supabase customer field. The number is unverified and is not used for SMS
authentication or customer sign-in. Existing legacy NRIC data is preserved but
is no longer read by the application.

The vendor customer-wallet scanner now renders its live camera surface while
the scanner starts, keeps a visible preview and targeting frame active during
scanning, and provides an explicit stop control and manual fallback. The admin
tokener detail now exposes a two-step **Add credits** modal: manual PayNow/cash
evidence is captured first through separate **Take photo** and **Upload image**
controls, then a valid selection advances directly to the SGD amount step.
Phone-native HEIC/HEIF plus JPEG, PNG, and WebP images up to 10 MB are accepted.
A private Supabase Storage bucket and atomic database function record evidence
metadata and its audit before appending the token issuance, ledger credit, and
issuance audit. Evidence bytes remain outside audit metadata.

The add-credits evidence controls now separate true camera capture from upload.
**Take photo** opens an in-app camera preview through `getUserMedia` and
captures the current frame as a JPEG evidence file; **Upload image** remains the
file-picker fallback for saved screenshots.

The deployed-prototype credit rule is now fixed at **S$1.00 = 1 token**. The
amount step previews the exact result before confirmation, including fractional
credits such as S$0.50 to 0.5 token and S$12.50 to 12.5 tokens. Supabase stores
issuance and ledger token amounts as fixed `numeric(14,2)` values. Bootstrap
repairs a missing event settings row and changes an older rate to one token per
dollar. The issuance boundary also rejects a database result that does not
match that one-to-one calculation. Migrations
`20260729143000_add_admin_credit_issuance.sql` and
`20260729161500_set_one_to_one_token_rate.sql` have been pushed to the hosted
Supabase project.

The administrator activity route `/admin/transactions` now loads categorized
Supabase-backed reports. The **Token issuance** report shows each credit
issuance with customer name, mobile number, received amount, issued token amount,
payment method, reference, and a signed Supabase Storage evidence-preview link.
The **Game booths** and **Food booths** reports group hosted vendor ledger
activity into booth summaries, include Booth 1-6 filters, show each selected
booth's net/in/out token totals, and list the matching booth transactions. All
three reports export CSV files that open cleanly in Google Sheets, with formula
prefixes escaped. Both the transactions and tokener screens distinguish missing
Supabase configuration or prototype-session state from a genuine connected
empty result; neither falls back to IndexedDB for hosted records.

The hosted prototype now includes 12 named vendor login credentials: six game
stores and six food stores. Their Supabase account profiles, event role
memberships, wallets, and vendor rows were seeded with `.env.local` credentials
on 2026-07-29. The prototype login bridge accepts those vendor usernames while
keeping administrator recovery copy generic, so the seeded administrator
username is not shown in the hosted-session error states. The credential sheet
is kept in local `VENDOR_ACCOUNTS.md` and ignored by Git.

The evidence-backed credit issuance path now validates the strict request
fields separately from the uploaded evidence file, repairs missing Supabase
event-role memberships during baseline setup, and coerces Postgres numeric
token amounts returned as strings before recalculating balances. A localhost
smoke test issued S$12.50 to Lance Tan and the hosted tokener summary returned
the updated 12.5-token balance with HTTP 200.

The hosted vendor dashboard now opens a compact action sheet immediately after
a customer wallet QR resolves. The vendor can only choose **Deduct**, enter the
token amount, confirm, and get a compact receipt. Deduct calls a Supabase RPC
that appends paired customer `customer_purchase` debit and vendor
`vendor_receipt` credit entries plus a `purchase_completed` audit record. The
signed prototype cookie carries the vendor username so the correct hosted vendor
account is adjusted.

The vendor dashboard also loads the signed-in vendor's hosted wallet balance
and recent ledger changes from `/api/vendor/overview`. That endpoint now uses
the `get_vendor_overview` database helper so Postgres returns the aggregate
balance plus the 12 visible activity rows instead of sending every vendor ledger
row to Node. Vendor network actions dim the screen with a centered loading
indicator while lookup, save, or overview refresh work is in progress.

The vendor scan/charge hot path no longer runs the Supabase baseline repair and
vendor-account upsert loop on every request. Customer wallet resolution now
performs only the QR/customer wallet lookup, while quick charge calls go
straight to the database RPC and refresh the receipt before reloading the vendor
activity panel.

Admin tokener listing no longer performs per-customer account and ledger
queries or Supabase baseline repair. It now uses one lightweight event lookup
plus bulk customer, account, and ledger reads, and opens transaction history on
demand from the tokener popup. Tokener creation uses the lightweight event
lookup and returns the newly created read model from the inserted rows instead
of reloading the account and ledger afterward.

Hosted read paths no longer run Supabase baseline repair. The hosted event,
admin account, event settings, and vendor login/booth records are maintained by
migrations and controlled setup/reset steps instead of being repaired during
customer, vendor, tokener, or administrator activity requests.

Claim QR redemption, private account loading, and wallet QR regeneration now
skip Supabase baseline repair entirely and query the target customer record
directly. This removes the vendor-account upsert loop from the customer opening
path while preserving the same access checks and wallet balance calculation.

The `/enter` surface now uses the earlier publicly listed Big Blue Floorball
image from the official site instead of generated local raster art. The mobile
hero keeps the image full-width and centered so the photo is no longer visibly
cut off before the login form.

Refund authority now sits with administrators. The local `RefundService`,
deterministic seed data, and refund integration tests reject vendor actors and
record refund actors as administrators. The hosted vendor dashboard no longer
shows an **Add** or refund action after scanning a customer wallet, and the
vendor charge API accepts only deductions. Supabase migration
`20260731090000_add_admin_vendor_transaction_refund.sql` drops the hosted vendor
quick-return RPC and adds an administrator-only refund RPC that reverses a
selected vendor charge transaction with linked customer credit and vendor debit
ledger entries.

The administrator tokeners screen now opens each tokener in a popup instead of a
sticky side profile. The popup hides raw private account links and raw claim-code
values, keeps the one-time claim QR available, loads wallet transaction history
on demand through `/api/admin/tokeners/[customerId]`, and lets an administrator
record a full or partial refund from a selected vendor charge. Customer history
labels refund credits as received refunds, vendor history labels vendor refund
debits as admin refunds, and the admin transaction reports include a dedicated
**Vendor1** tab so the simple `Vendor1` account's activity is visible separately
from game and food booth reports.

Administrator activity loading now avoids the previous repair and full-ledger
metric pass. `/api/admin/transactions` uses the `get_admin_transaction_metrics`
database helper for headline totals, keeps the visible issuance and booth
reports, and no longer builds an unused top-level transaction list.

## Validation record

| Command/check                             | Result              | Notes                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace inspection                      | Passed              | Workspace was initially empty except for Git metadata                                                                                                                                                                                                                                                                                                            |
| `npm install`                             | Passed, 2026-07-27  | Lockfile created with Node 24.18.0 and npm 11.16.0                                                                                                                                                                                                                                                                                                               |
| `npm run dev`                             | Passed, 2026-07-27  | Development server started; `/` returned HTTP 200                                                                                                                                                                                                                                                                                                                |
| Targeted Prettier check                   | Passed, 2026-07-27  | Phase 1 application/configuration/test files                                                                                                                                                                                                                                                                                                                     |
| `npm run lint`                            | Passed, 2026-07-27  | ESLint completed without errors                                                                                                                                                                                                                                                                                                                                  |
| `npm run typecheck`                       | Passed, 2026-07-27  | Strict TypeScript completed without errors                                                                                                                                                                                                                                                                                                                       |
| `npm run test`                            | Passed, 2026-07-27  | Foundation Vitest suite: 1 test passed                                                                                                                                                                                                                                                                                                                           |
| Targeted Phase 2 domain tests             | Passed, 2026-07-27  | 14 schema tests passed across shared primitives, ledger entries, orders, and settlements                                                                                                                                                                                                                                                                         |
| Targeted Phase 2 lint                     | Passed, 2026-07-27  | ESLint completed without errors for `src/modules`, shared types, and shared validation                                                                                                                                                                                                                                                                           |
| Targeted Phase 2 seed/audit tests         | Passed, 2026-07-27  | 10 deterministic seed, cross-store integrity, reset facade, and append-only audit unit tests passed                                                                                                                                                                                                                                                              |
| Phase 2 seed lifecycle integration tests  | Passed, 2026-07-27  | 2 first-run metadata/idempotence and enabled development reseed tests passed against fake IndexedDB                                                                                                                                                                                                                                                              |
| Targeted Phase 2 seed/audit lint          | Passed, 2026-07-27  | ESLint completed without errors for the seed, lifecycle, audit, and related integration-test files                                                                                                                                                                                                                                                               |
| Targeted Phase 2 seed/audit format check  | Passed, 2026-07-27  | Prettier check passed for the seed, lifecycle, audit, integration-test, and updated documentation files                                                                                                                                                                                                                                                          |
| Phase 2 repository integration tests      | Passed, 2026-07-27  | 15 IndexedDB schema, adapter, safety-boundary, isolation, unit-of-work, and concurrent initialization tests passed                                                                                                                                                                                                                                               |
| Latest combined Phase 2 typecheck         | Passed, 2026-07-27  | Strict TypeScript completed without errors after persistence review fixes                                                                                                                                                                                                                                                                                        |
| Combined Phase 2 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                                                                                                                               |
| Combined Phase 2 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                                                                                                                              |
| Combined Phase 2 test suite               | Passed, 2026-07-27  | `vitest run`: 11 files and 45 tests passed                                                                                                                                                                                                                                                                                                                       |
| Phase 3 ledger/issuance typecheck         | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the shared transaction and issuance slice                                                                                                                                                                                                                                                          |
| Phase 3 ledger/issuance targeted tests    | Passed, 2026-07-27  | 5 Vitest files and 26 tests passed, including duplicate idempotency/reference handling and IndexedDB rollback                                                                                                                                                                                                                                                    |
| Phase 3 ledger/issuance targeted lint     | Passed, 2026-07-27  | ESLint completed without errors for the ledger, transaction-provider, issuance, and integration-test slice                                                                                                                                                                                                                                                       |
| Phase 3 ledger/issuance format check      | Passed, 2026-07-27  | Prettier check passed for the ledger/issuance implementation, tests, public exports, and updated documentation                                                                                                                                                                                                                                                   |
| Phase 3 integrity follow-up tests         | Passed, 2026-07-27  | 10 Vitest files and 85 tests passed across ledger semantics, issuance authorization/tamper cases, seed v2, and IndexedDB lifecycle                                                                                                                                                                                                                               |
| Phase 3 integrity follow-up typecheck     | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the compatibility and collision changes                                                                                                                                                                                                                                                            |
| Phase 3 integrity follow-up lint          | Passed, 2026-07-27  | Targeted ESLint completed without errors for all files changed by the integrity follow-up                                                                                                                                                                                                                                                                        |
| Phase 3 integrity follow-up format check  | Passed, 2026-07-27  | Targeted Prettier check passed for all changed implementation, test, seed, lifecycle, and documentation files                                                                                                                                                                                                                                                    |
| Combined Phase 3 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                                                                                                                               |
| Combined Phase 3 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                                                                                                                              |
| Combined Phase 3 typecheck                | Passed, 2026-07-27  | `tsc --noEmit` completed without errors                                                                                                                                                                                                                                                                                                                          |
| Combined Phase 3 test suite               | Passed, 2026-07-27  | `vitest run`: 23 files and 164 tests passed, including atomic rollback and concurrent wallet mutation coverage                                                                                                                                                                                                                                                   |
| Phase 4 auth/runtime focused tests        | Passed, 2026-07-27  | 36 unit and RTL tests passed for mobile normalization, generic entry failures, role destinations/permissions, minimal session storage, runtime initialization/switching, sign-out, and `/enter` states                                                                                                                                                           |
| Phase 4 auth IndexedDB integration tests  | Passed, 2026-07-27  | 2 tests passed for atomic active-customer entry/audit and unknown-account rejection                                                                                                                                                                                                                                                                              |
| Phase 4 auth/runtime targeted lint        | Passed, 2026-07-27  | ESLint completed without errors for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                                                                                                                                                                                       |
| Phase 4 auth/runtime format check         | Passed, 2026-07-27  | Prettier check passed for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                                                                                                                                                                                                 |
| Phase 4 auth/runtime typecheck            | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the combined Phase 4 composition                                                                                                                                                                                                                                                                   |
| Phase 4 auth audit follow-up tests        | Passed, 2026-07-27  | 7 files and 24 tests passed for private runtime boundaries, gated account discovery/switching, safe entry errors, single redirect ownership, IndexedDB lifecycle, and rapid reload/unmount cleanup                                                                                                                                                               |
| Phase 4 auth audit follow-up lint         | Passed, 2026-07-27  | Targeted ESLint completed without errors for the authentication/runtime, configured account query, `/enter`, and role-switcher follow-up                                                                                                                                                                                                                         |
| Phase 4 auth audit follow-up format       | Passed, 2026-07-27  | Targeted Prettier check completed successfully for all follow-up implementation and test files                                                                                                                                                                                                                                                                   |
| Phase 4 auth audit follow-up typecheck    | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after removing public repository handles                                                                                                                                                                                                                                                                 |
| Phase 4 PIN targeted tests                | Passed, 2026-07-27  | 12 unit and 3 IndexedDB integration tests passed, including seed digest compatibility, validation, lock timing, rollback, safe audits, setup/change, reset, and concurrent wrong attempts                                                                                                                                                                        |
| Phase 4 PIN targeted lint                 | Passed, 2026-07-27  | ESLint completed without errors for the PIN schemas, service, prototype credential derivation, and unit/integration tests                                                                                                                                                                                                                                        |
| Phase 4 PIN repository typecheck          | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the Phase 4 PIN public API and local composition were integrated                                                                                                                                                                                                                                   |
| Phase 4 onboarding/dev targeted tests     | Passed, 2026-07-27  | 10 Vitest files and 32 tests passed across atomic onboarding and rollback, the four-step RTL flow, role redirects/switching, strict route gating, confirmed reset/reseed, and runtime reload                                                                                                                                                                     |
| Phase 4 onboarding/dev targeted lint      | Passed, 2026-07-27  | ESLint completed without errors for the onboarding module/routes, developer-tool module/routes, configuration boundaries, and focused tests                                                                                                                                                                                                                      |
| Phase 4 onboarding/dev typecheck          | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after onboarding and development-tool runtime composition                                                                                                                                                                                                                                                |
| Phase 4 onboarding/dev format check       | Passed, 2026-07-27  | Prettier check passed for the onboarding and development-tool implementation, routes, tests, configuration, global motion style, test setup, and status documentation                                                                                                                                                                                            |
| Phase 4 onboarding/dev audit tests        | Passed, 2026-07-27  | 10 focused Vitest files and 35 tests passed, including safe failure copy, caught retry rejection, runtime-error reset/reseed, feedback persistence, active navigation, and IndexedDB audit rollback                                                                                                                                                              |
| Phase 4 onboarding/dev audit lint         | Passed, 2026-07-27  | ESLint completed without errors for all onboarding, development-data recovery, development-navigation, and onboarding integration-test files changed by the audit follow-up                                                                                                                                                                                      |
| Phase 4 onboarding/dev audit typecheck    | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the onboarding/development audit follow-up and current runtime public API were integrated                                                                                                                                                                                                          |
| Phase 4 onboarding/dev audit format       | Passed, 2026-07-27  | Prettier check passed for all onboarding, development-data recovery, development-navigation, status, and onboarding integration-test files changed by the audit follow-up                                                                                                                                                                                        |
| Combined Phase 4 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                                                                                                                               |
| Combined Phase 4 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                                                                                                                              |
| Combined Phase 4 typecheck                | Passed, 2026-07-27  | `tsc --noEmit` completed without errors after the independent audit fixes                                                                                                                                                                                                                                                                                        |
| Combined Phase 4 test suite               | Passed, 2026-07-27  | `vitest run`: 45 test files and 264 tests passed                                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-27  | Next.js 16.2.12 production build completed with `/enter`, `/customer/onboarding`, and gated development routes                                                                                                                                                                                                                                                   |
| `npm run test:e2e`                        | Not run/recorded    | Await Playwright flows                                                                                                                                                                                                                                                                                                                                           |
| Customer access focused tests             | Passed, 2026-07-28  | 3 Vitest tests passed for one-time claim redemption, stable private account link, wallet QR regeneration, and refreshed short-lived claim QR                                                                                                                                                                                                                     |
| `npm run format`                          | Passed, 2026-07-28  | Prettier rewrote repository files after the customer-access implementation                                                                                                                                                                                                                                                                                       |
| `npm run format:check`                    | Passed, 2026-07-28  | Repository-wide Prettier check completed with all matched files formatted                                                                                                                                                                                                                                                                                        |
| `npm run lint`                            | Passed, 2026-07-28  | Repository-wide ESLint completed without errors after the customer-access implementation and hook dependency cleanup                                                                                                                                                                                                                                             |
| `npm run typecheck`                       | Passed, 2026-07-28  | Repository-wide `tsc --noEmit` completed after the customer-access implementation and narrow test mock type fixes                                                                                                                                                                                                                                                |
| `npm run test`                            | Passed, 2026-07-28  | Repository-wide Vitest suite passed: 60 test files and 324 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-28  | Next.js 16.2.12 production build completed with the admin tokener, claim, and private account routes                                                                                                                                                                                                                                                             |
| `npm run test:e2e`                        | Not run, 2026-07-28 | Playwright flows remain pending after this customer-access slice                                                                                                                                                                                                                                                                                                 |
| Admin credential / QR-only tokener tests  | Passed, 2026-07-28  | 8 focused Vitest files and 33 tests passed for seeded super-admin username/password entry, QR-only tokener access, data version 4, and customer access service behaviour                                                                                                                                                                                         |
| Numeric private-link update tests         | Passed, 2026-07-28  | Focused customer-access, local repository, local seed lifecycle, and development-data route tests passed after data version 5 numeric private-account link update                                                                                                                                                                                                |
| `npm run lint`                            | Passed, 2026-07-28  | Repository-wide ESLint completed after the admin credential and QR-only tokener updates                                                                                                                                                                                                                                                                          |
| `npm run typecheck`                       | Passed, 2026-07-28  | Repository-wide `tsc --noEmit` completed after the admin credential and QR-only tokener updates                                                                                                                                                                                                                                                                  |
| `npm run test`                            | Passed, 2026-07-28  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-28  | Next.js 16.2.12 production build completed with the admin credential entry and QR-only private account routes                                                                                                                                                                                                                                                    |
| LAN phone preview                         | Passed, 2026-07-28  | `next dev` was restarted on `0.0.0.0:3000`; `/enter` returned HTTP 200 through `http://192.168.1.46:3000/enter`                                                                                                                                                                                                                                                  |
| Supabase migration push                   | Passed, 2026-07-29  | `npx supabase link --project-ref infiighwjaajxlwzwkgd --password ... --yes` and `npx supabase db push --password ...` applied `20260728154615_initial_tokenly_schema.sql`; Docker-only migration catalog cache warning did not block the remote push                                                                                                             |
| Supabase health endpoint                  | Passed, 2026-07-29  | `/api/supabase/health` returned HTTP 200 and verified 16 migrated tables with no table errors                                                                                                                                                                                                                                                                    |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after ignoring Supabase CLI temp state and formatting the Supabase health route                                                                                                                                                                                                                                         |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed after adding the Supabase server health route                                                                                                                                                                                                                                                                                   |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after adding the Supabase server health route                                                                                                                                                                                                                                                                           |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/api/supabase/health` as a dynamic server route                                                                                                                                                                                                                                                                 |
| Supabase NRIC migration                   | Passed, 2026-07-29  | `npx supabase db push --password ...` applied `20260729101000_add_customer_nric.sql`; Docker-only migration catalog cache warning did not block the remote push                                                                                                                                                                                                  |
| Supabase deployment API smoke             | Passed, 2026-07-29  | Prototype login cookie returned HTTP 200; authenticated admin tokeners API returned Lance Tan from Supabase; authenticated vendor customer-wallet resolver returned Lance Tan and balance 0                                                                                                                                                                      |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                                                                                                                                |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                                                                                                                                        |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                                                                                                                                |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with admin, customer-access, prototype-auth, and vendor dynamic API routes                                                                                                                                                                                                                                            |
| Camera/credit wizard focused tests        | Passed, 2026-07-29  | 7 focused Vitest tests passed for visible scanner startup/scan states and the evidence-first, amount-second add-credits modal                                                                                                                                                                                                                                    |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the vendor camera preview and evidence-backed credit issuance changes                                                                                                                                                                                                                                             |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors for the camera, modal, API, storage, and issuance changes                                                                                                                                                                                                                                                        |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed without errors for the multipart evidence and atomic issuance path                                                                                                                                                                                                                                                      |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 61 test files and 321 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with the updated vendor dashboard and admin tokener credit API                                                                                                                                                                                                                                                        |
| Supabase localhost admin smoke            | Passed, 2026-07-29  | With `.env.local` loaded, prototype admin login returned HTTP 200, the hosted tokeners API returned 2 records, and the hosted transactions API returned an authenticated empty overview with zero groups                                                                                                                                                         |
| Admin transaction focused tests           | Passed, 2026-07-29  | 2 RTL tests passed for connected zero metrics/empty activity and recoverable missing-Supabase-configuration handling                                                                                                                                                                                                                                             |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors after the Supabase admin transaction route and error-state changes                                                                                                                                                                                                                                               |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed without errors after adding the admin transaction read model and API                                                                                                                                                                                                                                                    |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 62 test files and 323 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/admin/transactions` and `/api/admin/transactions`                                                                                                                                                                                                                                                              |
| Entry and development-route focused tests | Passed, 2026-07-29  | 13 focused Vitest tests passed for the two-panel login, access-QR parser, entry client, development navigation, and development route gate                                                                                                                                                                                                                       |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the `/enter` redesign and removal of exposed development-data controls                                                                                                                                                                                                                                            |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without warnings after the entry QR and development-tool cleanup                                                                                                                                                                                                                                                                |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after regenerating route types without `/dev/data`                                                                                                                                                                                                                                                                      |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 315 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/enter`, `/dev`, and `/dev/role-switcher`; `/dev/data` is absent from the emitted route table                                                                                                                                                                                                                   |
| One-to-one credit focused tests           | Passed, 2026-07-29  | 7 focused modal tests passed, including S$50-to-50-token and S$0.50-to-0.5-token previews                                                                                                                                                                                                                                                                        |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the one-to-one conversion changes                                                                                                                                                                                                                                                                                 |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors or warnings                                                                                                                                                                                                                                                                                                      |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed with the rate enforcement and bootstrap repair                                                                                                                                                                                                                                                                          |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 317 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with the one-to-one admin credit issuance path                                                                                                                                                                                                                                                                        |
| Fractional credit focused tests           | Passed, 2026-07-29  | 7 focused modal tests passed, including S$0.50-to-0.5-token submission                                                                                                                                                                                                                                                                                           |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after fixed-decimal token support                                                                                                                                                                                                                                                                                       |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors or warnings                                                                                                                                                                                                                                                                                                      |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed with fractional Supabase ledger amounts                                                                                                                                                                                                                                                                                 |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 317 tests                                                                                                                                                                                                                                                                                                 |
| `npm run build`                           | Environment blocked | Next.js could not unlink the existing OneDrive reparse-point directory `.next/static/dP88xmBa-KFHq-ebKPEg4` (`EPERM`); three retries produced the same filesystem error before compilation                                                                                                                                                                       |
| Supabase credit/rate migrations           | Passed, 2026-07-29  | `.env.local` migration credentials loaded locally; `npx supabase db push --password ...` applied `20260729143000_add_admin_credit_issuance.sql` and `20260729161500_set_one_to_one_token_rate.sql`. CLI migration-list verification shows all four local migrations present remotely. Docker-only migration catalog cache warning did not block the remote push. |
| Supabase vendor account seed              | Passed, 2026-07-29  | `.env.local` server credentials loaded locally; 12 hosted vendor account profiles, memberships, wallets, and vendor rows were upserted. Verification counted 12 requested vendor accounts and 12 vendor memberships.                                                                                                                                             |
| Hosted credit issuance smoke              | Passed, 2026-07-29  | Localhost API login succeeded; `POST /api/admin/tokeners/c5f76eac-a859-4d7a-bf09-a8dd588d6b83/tokens` with S$12.50 and PNG evidence returned HTTP 200 and refreshed Lance Tan's Supabase balance to 12.5 tokens.                                                                                                                                                 |
| Hosted vendor login smoke                 | Passed, 2026-07-29  | `POST /api/prototype-auth/login` returned HTTP 200 for `GameVendor01` and `FoodVendor06`.                                                                                                                                                                                                                                                                        |
| Focused post-vendor checks                | Passed, 2026-07-29  | Targeted Prettier check, repository lint, strict TypeScript, and focused Vitest files for account entry, add-credits dialog, and admin transactions completed successfully after the vendor and credit fixes.                                                                                                                                                    |

| Supabase vendor charge migration | Passed, 2026-07-29 | `npx supabase db push --password ...` applied `20260729225000_add_vendor_customer_charge.sql`; migration-list verification shows the migration present remotely. Docker-only migration catalog cache warning did not block the remote push. |
| Hosted vendor charge smoke | Passed, 2026-07-29 | `GameVendor01` prototype login succeeded; `POST /api/vendor/customer-wallet/charge` deducted 0.5 token from Lance Tan's hosted wallet and returned HTTP 200 with reference `PAY-1785337321754-743ff477`. |
| Vendor charge UI checks | Passed, 2026-07-29 | Targeted Prettier check, repository lint, and strict TypeScript completed successfully after adding the vendor visual confirmation and quick-charge flow. |

| Vendor overview smoke | Passed, 2026-07-29 | `GameVendor01` prototype login succeeded; `GET /api/vendor/overview` returned HTTP 200 with Stick & Grip Pro Shop balance and three recent hosted ledger activity rows. |

| Vendor hot-path timing smoke | Passed, 2026-07-29 | After removing baseline repair from vendor hot paths, local dev `GET /api/vendor/overview` returned HTTP 200 in about 1035 ms and `POST /api/vendor/customer-wallet/resolve` returned HTTP 200 in about 473 ms through a `GameVendor01` cookie. |

| Tokener list/create timing smoke | Passed, 2026-07-29 | After bulk-loading tokeners, local dev `GET /api/admin/tokeners` returned HTTP 200 in about 747 ms and `POST /api/admin/tokeners` created a fake speed-test tokener in about 915 ms through an administrator cookie. |

| Big Blue entry visual assets | Passed, 2026-07-29 | Generated and added `public/brand/big-blue-floorball-hero.png` and `public/brand/big-blue-token-booth.png`; `/enter` no longer depends on a remote front image. |
| `npm run format` | Passed, 2026-07-29 | Repository Prettier write completed after existing formatting drift blocked the first `format:check`. |
| `npm run format:check` | Passed, 2026-07-29 | Repository-wide Prettier check completed after the entry visual and e2e smoke updates. |
| `npm run lint` | Passed, 2026-07-29 | Repository-wide ESLint completed without errors after the local image and Playwright updates. |
| `npm run typecheck` | Passed, 2026-07-29 | Repository-wide `tsc --noEmit` completed without errors after regenerating Next route types. |
| `npm run test` | Passed, 2026-07-29 | Repository-wide Vitest suite passed: 60 test files and 317 tests. |
| `npm run build` | Passed, 2026-07-29 | Next.js 16.2.12 production build completed with the current admin, vendor, customer-access, and `/enter` routes. |
| `npm run test:e2e:install` | Passed, 2026-07-29 | Installed the local Chromium browser binaries required by Playwright. The tablet project now explicitly uses Chromium instead of inheriting WebKit from the iPad device preset. |
| `npm run test:e2e` | Passed, 2026-07-29 | Playwright smoke passed on mobile, desktop, and tablet Chromium for the current `/` to `/enter` flow. |
| `/enter` visual smoke | Passed, 2026-07-29 | Playwright desktop and mobile screenshots confirmed the ready login state, local hero image rendering, readable form layout, and mobile fit. |
| Hosted wallet balance hotfix | Passed, 2026-07-30 | Restored `wallet_id` to the shared Supabase ledger-entry select after local smoke found add-credit, private-account, and vendor wallet resolution responses were crashing after successful ledger writes. |
| Admin report API smoke | Passed, 2026-07-30 | With `.env.local` loaded, localhost admin login succeeded and `/api/admin/transactions` returned HTTP 200 with 6 credit issuances, 6 game-booth summaries, 3 game transactions, 6 food-booth summaries, and 0 food transactions from the hosted Supabase data. |
| Entry/admin visual smoke | Passed, 2026-07-30 | Playwright mobile screenshots confirmed the restored public Big Blue `/enter` image framing and the `/admin/transactions` mobile report with visible customer name, NRIC, amount, payment method, reference, and evidence preview controls. |
| Tokener mobile-number focused tests | Passed, 2026-08-01 | 2 Vitest files and 12 tests passed for mobile-number normalization/rejection, legacy NRIC payload rejection, tokener popup behaviour, and administrator refund interaction. |
| Tokener mobile-number lint | Passed, 2026-08-01 | Repository-wide ESLint completed without errors after the creation, reporting, and admin-screen update. |
| Tokener mobile-number typecheck | Passed, 2026-08-01 | Repository-wide `tsc --noEmit` completed without errors after installing the locked dependencies. |
| Tokener mobile-number format check | Passed, 2026-08-01 | Repository-wide Prettier check completed successfully. |
| Tokener mobile-number full tests | Passed, 2026-08-01 | All 62 Vitest files and 329 tests passed. |
| `npm run build` | Passed, 2026-08-01 | Next.js 16.2.12 production build compiled, typechecked, and generated all routes with the mobile-number creation flow. |
| Supabase customer mobile-number migration | Passed, 2026-08-01 | Direct authenticated database push applied `20260801090000_add_customer_mobile_number.sql`; the remote migration list confirmed matching local/remote versions. A Docker-only migration catalog cache warning did not block the push. |
| Focused report and camera tests | Passed, 2026-07-30 | 15 focused Vitest tests passed for the admin transactions screen, add-credits dialog, and account-entry screen after the report, evidence-control, and entry-image changes. |
| `npm run format` | Passed, 2026-07-30 | Repository Prettier write completed with no changed files after the admin report and entry image updates. |
| `npm run format:check` | Passed, 2026-07-30 | Repository-wide Prettier check completed after the admin report and entry image updates. |
| `npm run lint` | Passed, 2026-07-30 | Repository-wide ESLint completed without errors after the admin report and entry image updates. |
| `npm run typecheck` | Passed, 2026-07-30 | Repository-wide `tsc --noEmit` completed without errors after the admin report and entry image updates. |
| `npm run test` | Passed, 2026-07-30 | Repository-wide Vitest suite passed: 60 test files and 317 tests. |
| `npm run build` | Passed, 2026-07-30 | Next.js 16.2.12 production build completed with the current admin reports, evidence controls, Supabase APIs, and `/enter` route. |
| `npm run test:e2e` | Passed, 2026-07-30 | Playwright smoke passed on mobile, desktop, and tablet Chromium for the current `/` to `/enter` flow. |
| Supabase migration sync | Passed, 2026-07-30 | `supabase migration list --linked` showed all six local migrations present remotely, and `supabase db push --linked` reported the remote database was up to date. |
| Supabase demo reset backup | Passed, 2026-07-30 | A JSON snapshot of public Supabase tables was written outside the repository to `C:\Tokenly-db-backups` before reset. The CLI SQL dump path was unavailable because Docker Desktop is not installed. |
| Supabase demo reset | Passed, 2026-07-30 | Removed 6 private payment-evidence storage objects, cleared hosted customers, token issuances, ledger entries, audit logs, evidence, orders, refunds, and settlements, and preserved 1 `AdminLance` account plus 13 vendor accounts, 13 vendor rows, and 13 vendor wallets. |
| Clean database API smoke | Passed, 2026-07-30 | Local admin API smoke returned 0 tokeners, 0 credit issuances, 0 transaction groups, 6 game booth summaries, and 6 food booth summaries. Follow-up counts confirmed customers, token issuances, ledger entries, audit logs, and evidence stayed at zero. |
| Add-credit camera focused test | Passed, 2026-07-30 | Focused add-credits dialog tests passed after replacing file-input camera capture with the in-app camera preview and keeping upload as a separate fallback. |
| Claim/private account speed smoke | Passed, 2026-07-30 | Localhost missing-claim and missing-private-link API requests completed without running Supabase baseline repair; warm private-link misses returned in about 160-173 ms and claim misses in about 323 ms. |

| `npm run format` | Passed, 2026-07-31 | Repository Prettier write completed after moving refunds to administrator control and adding the admin tokener popup refund flow. |
| `npm run format:check` | Passed, 2026-07-31 | Repository-wide Prettier check completed after the admin refund and popup changes. |
| `npm run lint` | Passed, 2026-07-31 | Repository-wide ESLint completed without errors after removing the vendor refund action and adding the admin refund popup. |
| `npm run typecheck` | Passed, 2026-07-31 | Repository-wide `tsc --noEmit` completed with the expanded admin tokener transaction read model and new admin refund API route. |
| Focused admin refund checks | Passed, 2026-07-31 | Focused Vitest run passed: 5 files and 31 tests covering `RefundService`, refund/adjustment integration, local seed lifecycle, admin tokeners popup refund submission, and admin transaction reports. |
| `npm run test` | Passed, 2026-07-31 | Repository-wide Vitest suite passed: 61 test files and 319 tests. |
| `npm run build` | Passed, 2026-07-31 | Next.js 16.2.12 production build completed; route table includes `/api/admin/tokeners/[customerId]`, `/api/admin/tokeners/[customerId]/refunds`, and the vendor dashboard route. |
| `npm run test:e2e` | Passed, 2026-07-31 | Playwright smoke passed on mobile, desktop, and tablet Chromium for the current `/` to `/enter` flow. |
| Supabase admin refund migration | Passed, 2026-07-31 | `npx supabase db push --linked` applied `20260731090000_add_admin_vendor_transaction_refund.sql`, dropping the hosted vendor quick-return RPC and adding the administrator refund RPC. Docker-only migration catalog cache warning did not block the remote push. |
| Supabase migration-list verification | Passed, 2026-07-31 | `npx supabase migration list --linked` showed all seven local migrations present remotely, including `20260731090000`. |
| `npm run format:check` | Passed, 2026-07-31 | Repository-wide Prettier check completed after the activity fast-path changes and documentation updates. |
| `npm run lint` | Passed, 2026-07-31 | Repository-wide ESLint completed without errors after removing the unused Supabase baseline repair path and moving the refund permission to administrators. |
| `npm run typecheck` | Passed, 2026-07-31 | Repository-wide `tsc --noEmit` completed with the activity helper RPC clients and permission update. |
| Focused activity and permission checks | Passed, 2026-07-31 | Focused Vitest run passed: 3 files and 8 tests covering role permissions, admin activity screen, and admin tokeners popup behavior. |
| `npm run test` | Passed, 2026-07-31 | Repository-wide Vitest suite passed: 61 test files and 319 tests after the activity fast-path changes. |
| `npm run build` | Passed, 2026-07-31 | Next.js 16.2.12 production build completed with `/api/admin/transactions`, `/api/vendor/overview`, and the admin tokener routes. |
| `npm run test:e2e` | Passed, 2026-07-31 | Playwright smoke passed on mobile, desktop, and tablet Chromium for the current `/` to `/enter` flow after the activity helper changes. |
| Supabase activity helper migration | Passed, 2026-07-31 | `npx supabase db push --linked` applied `20260731093000_add_activity_overview_helpers.sql`, adding compact administrator metric and vendor overview helper RPCs. Docker-only migration catalog cache warning did not block the remote push. |
| Supabase migration-list verification | Passed, 2026-07-31 | `npx supabase migration list --linked` showed all eight local migrations present remotely, including `20260731093000`. |
| Activity API timing smoke | Passed, 2026-07-31 | Existing localhost dev server smoke through prototype cookies loaded `/api/admin/transactions` in about 2577 ms and `/api/vendor/overview` for `Vendor1` in about 421 ms; the admin response returned 3 booth reports and the vendor response returned 5 recent rows. |
| Pre-operations token clearance backup | Passed, 2026-07-31 | JSON backup written outside the repository to `C:\Tokenly-db-backups\tokenly-token-clearance-backup-2026-07-31T154145-803Z.json` before clearing hosted token/spending data for 2026-08-01 operations. The backup captured 2 customers, 2 token issuances, 12 ledger entries, 9 audit rows, and 2 payment-evidence storage objects. |
| Hosted token/spending clearance | Passed, 2026-07-31 | Linked Supabase SQL cleared hosted `ledger_entries`, `token_issuances`, `orders`, `order_items`, `refunds`, `settlements`, and `evidence`, then inserted one `operational_token_clearance` audit marker while preserving accounts, customers, vendors, wallets, event settings, and claim/private links. |
| Payment evidence storage clearance | Passed, 2026-07-31 | Removed 2 private `payment-evidence` storage objects and verified 0 objects remained. |
| Token clearance database verification | Passed, 2026-07-31 | Direct linked database checks showed `ledger_entries`, `token_issuances`, `orders`, `order_items`, `refunds`, `settlements`, and `evidence` at 0 rows; customer wallet total balance 0 across 2 wallets; vendor wallet total balance 0 across 13 wallets; 1 clearance audit row remained. |
| Token clearance API smoke | Passed, 2026-07-31 | Existing localhost dev server smoke through prototype cookies returned 2 tokeners with balances `0,0`, admin metrics 0 issued/spent/refunded/transaction groups, and `Vendor1` overview balance 0 with 0 recent activity rows. |

Replace "Not run/recorded" with the date, command, outcome, and concise failure limitation when a check is actually executed.

## Known limitations

- Product routes beyond the completed entry, onboarding, and development surfaces remain unavailable until their ordered role-application phases are implemented.
- The local prototype does not provide verified identity, verified payment, server-enforced authorization, or production-grade PIN security.
- Browser-local storage is editable by the browser user and unsuitable as a production wallet authority.
- Local data versions `1`, `2`, `3`, and `4` cannot be opened under the version
  `5` local numeric private-link, admin credential, and customer-access
  semantics. Local developers must deliberately clear only Tokenly's browser
  site data and reload.
- Phase 2 IndexedDB integration tests use fake IndexedDB with a Blob-compatible Node shim; real-browser persistence and refresh behaviour remain an end-to-end validation responsibility.
- Supabase currently supports the deployed tokener QR/admin prototype path; broader product flows still use IndexedDB until repository adapters, reviewed RLS, and server-side transaction functions are implemented.
- The deployed admin/vendor password flow uses a signed prototype cookie, not Supabase Auth, MFA, production password hashing, or durable account recovery.
- The prototype build is deployable as of the latest validation record, but production-grade launch remains deferred until the full Supabase-backed runtime path, RLS policies, and Vercel environment configuration are completed and reviewed.

## Next work

Implement Phase 5 customer home, wallet/history, account QR, vendor
scan/directory/storefront, basket, PIN-confirmed purchase receipt, and event
help. Use only capability-specific read/mutation boundaries; repository handles
and PIN credentials remain private.

Smoke-test remote one-to-one evidence-backed credit issuance against the
connected Supabase prototype before treating that hosted flow as event-ready.
