# Tokenly Implementation Status

Last updated: 2026-07-29

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
customer/vendor ledger pairs, full and partial vendor refunds, reasoned
administrator adjustments, and vendor settlement-period calculation. Every
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

The deployed-prototype credit rule is now fixed at **S$1.00 = 1 token**. The
amount step previews the exact result before confirmation, including fractional
credits such as S$0.50 to 0.5 token and S$12.50 to 12.5 tokens. Supabase stores
issuance and ledger token amounts as fixed `numeric(14,2)` values. Bootstrap
repairs a missing event settings row and changes an older rate to one token per
dollar. The issuance boundary also rejects a database result that does not
match that one-to-one calculation. Migration
`20260729161500_set_one_to_one_token_rate.sql` upgrades projects where the
earlier credit migration was already applied.

The incremental administrator activity route `/admin/transactions` now loads
ledger entries directly from the Supabase-backed API. It displays issued,
spent, refunded, and distinct transaction-group metrics, a recent technical
activity list, and a connected-empty state with zero metrics. Both the
transactions and tokener screens distinguish missing Supabase configuration or
prototype-session state from a genuine connected empty result; neither falls
back to IndexedDB for hosted records.

## Validation record

| Command/check                             | Result              | Notes                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace inspection                      | Passed              | Workspace was initially empty except for Git metadata                                                                                                                                                                                                |
| `npm install`                             | Passed, 2026-07-27  | Lockfile created with Node 24.18.0 and npm 11.16.0                                                                                                                                                                                                   |
| `npm run dev`                             | Passed, 2026-07-27  | Development server started; `/` returned HTTP 200                                                                                                                                                                                                    |
| Targeted Prettier check                   | Passed, 2026-07-27  | Phase 1 application/configuration/test files                                                                                                                                                                                                         |
| `npm run lint`                            | Passed, 2026-07-27  | ESLint completed without errors                                                                                                                                                                                                                      |
| `npm run typecheck`                       | Passed, 2026-07-27  | Strict TypeScript completed without errors                                                                                                                                                                                                           |
| `npm run test`                            | Passed, 2026-07-27  | Foundation Vitest suite: 1 test passed                                                                                                                                                                                                               |
| Targeted Phase 2 domain tests             | Passed, 2026-07-27  | 14 schema tests passed across shared primitives, ledger entries, orders, and settlements                                                                                                                                                             |
| Targeted Phase 2 lint                     | Passed, 2026-07-27  | ESLint completed without errors for `src/modules`, shared types, and shared validation                                                                                                                                                               |
| Targeted Phase 2 seed/audit tests         | Passed, 2026-07-27  | 10 deterministic seed, cross-store integrity, reset facade, and append-only audit unit tests passed                                                                                                                                                  |
| Phase 2 seed lifecycle integration tests  | Passed, 2026-07-27  | 2 first-run metadata/idempotence and enabled development reseed tests passed against fake IndexedDB                                                                                                                                                  |
| Targeted Phase 2 seed/audit lint          | Passed, 2026-07-27  | ESLint completed without errors for the seed, lifecycle, audit, and related integration-test files                                                                                                                                                   |
| Targeted Phase 2 seed/audit format check  | Passed, 2026-07-27  | Prettier check passed for the seed, lifecycle, audit, integration-test, and updated documentation files                                                                                                                                              |
| Phase 2 repository integration tests      | Passed, 2026-07-27  | 15 IndexedDB schema, adapter, safety-boundary, isolation, unit-of-work, and concurrent initialization tests passed                                                                                                                                   |
| Latest combined Phase 2 typecheck         | Passed, 2026-07-27  | Strict TypeScript completed without errors after persistence review fixes                                                                                                                                                                            |
| Combined Phase 2 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                   |
| Combined Phase 2 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                  |
| Combined Phase 2 test suite               | Passed, 2026-07-27  | `vitest run`: 11 files and 45 tests passed                                                                                                                                                                                                           |
| Phase 3 ledger/issuance typecheck         | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the shared transaction and issuance slice                                                                                                                                              |
| Phase 3 ledger/issuance targeted tests    | Passed, 2026-07-27  | 5 Vitest files and 26 tests passed, including duplicate idempotency/reference handling and IndexedDB rollback                                                                                                                                        |
| Phase 3 ledger/issuance targeted lint     | Passed, 2026-07-27  | ESLint completed without errors for the ledger, transaction-provider, issuance, and integration-test slice                                                                                                                                           |
| Phase 3 ledger/issuance format check      | Passed, 2026-07-27  | Prettier check passed for the ledger/issuance implementation, tests, public exports, and updated documentation                                                                                                                                       |
| Phase 3 integrity follow-up tests         | Passed, 2026-07-27  | 10 Vitest files and 85 tests passed across ledger semantics, issuance authorization/tamper cases, seed v2, and IndexedDB lifecycle                                                                                                                   |
| Phase 3 integrity follow-up typecheck     | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the compatibility and collision changes                                                                                                                                                |
| Phase 3 integrity follow-up lint          | Passed, 2026-07-27  | Targeted ESLint completed without errors for all files changed by the integrity follow-up                                                                                                                                                            |
| Phase 3 integrity follow-up format check  | Passed, 2026-07-27  | Targeted Prettier check passed for all changed implementation, test, seed, lifecycle, and documentation files                                                                                                                                        |
| Combined Phase 3 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                   |
| Combined Phase 3 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                  |
| Combined Phase 3 typecheck                | Passed, 2026-07-27  | `tsc --noEmit` completed without errors                                                                                                                                                                                                              |
| Combined Phase 3 test suite               | Passed, 2026-07-27  | `vitest run`: 23 files and 164 tests passed, including atomic rollback and concurrent wallet mutation coverage                                                                                                                                       |
| Phase 4 auth/runtime focused tests        | Passed, 2026-07-27  | 36 unit and RTL tests passed for mobile normalization, generic entry failures, role destinations/permissions, minimal session storage, runtime initialization/switching, sign-out, and `/enter` states                                               |
| Phase 4 auth IndexedDB integration tests  | Passed, 2026-07-27  | 2 tests passed for atomic active-customer entry/audit and unknown-account rejection                                                                                                                                                                  |
| Phase 4 auth/runtime targeted lint        | Passed, 2026-07-27  | ESLint completed without errors for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                                                                           |
| Phase 4 auth/runtime format check         | Passed, 2026-07-27  | Prettier check passed for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                                                                                     |
| Phase 4 auth/runtime typecheck            | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the combined Phase 4 composition                                                                                                                                                       |
| Phase 4 auth audit follow-up tests        | Passed, 2026-07-27  | 7 files and 24 tests passed for private runtime boundaries, gated account discovery/switching, safe entry errors, single redirect ownership, IndexedDB lifecycle, and rapid reload/unmount cleanup                                                   |
| Phase 4 auth audit follow-up lint         | Passed, 2026-07-27  | Targeted ESLint completed without errors for the authentication/runtime, configured account query, `/enter`, and role-switcher follow-up                                                                                                             |
| Phase 4 auth audit follow-up format       | Passed, 2026-07-27  | Targeted Prettier check completed successfully for all follow-up implementation and test files                                                                                                                                                       |
| Phase 4 auth audit follow-up typecheck    | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after removing public repository handles                                                                                                                                                     |
| Phase 4 PIN targeted tests                | Passed, 2026-07-27  | 12 unit and 3 IndexedDB integration tests passed, including seed digest compatibility, validation, lock timing, rollback, safe audits, setup/change, reset, and concurrent wrong attempts                                                            |
| Phase 4 PIN targeted lint                 | Passed, 2026-07-27  | ESLint completed without errors for the PIN schemas, service, prototype credential derivation, and unit/integration tests                                                                                                                            |
| Phase 4 PIN repository typecheck          | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the Phase 4 PIN public API and local composition were integrated                                                                                                                       |
| Phase 4 onboarding/dev targeted tests     | Passed, 2026-07-27  | 10 Vitest files and 32 tests passed across atomic onboarding and rollback, the four-step RTL flow, role redirects/switching, strict route gating, confirmed reset/reseed, and runtime reload                                                         |
| Phase 4 onboarding/dev targeted lint      | Passed, 2026-07-27  | ESLint completed without errors for the onboarding module/routes, developer-tool module/routes, configuration boundaries, and focused tests                                                                                                          |
| Phase 4 onboarding/dev typecheck          | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after onboarding and development-tool runtime composition                                                                                                                                    |
| Phase 4 onboarding/dev format check       | Passed, 2026-07-27  | Prettier check passed for the onboarding and development-tool implementation, routes, tests, configuration, global motion style, test setup, and status documentation                                                                                |
| Phase 4 onboarding/dev audit tests        | Passed, 2026-07-27  | 10 focused Vitest files and 35 tests passed, including safe failure copy, caught retry rejection, runtime-error reset/reseed, feedback persistence, active navigation, and IndexedDB audit rollback                                                  |
| Phase 4 onboarding/dev audit lint         | Passed, 2026-07-27  | ESLint completed without errors for all onboarding, development-data recovery, development-navigation, and onboarding integration-test files changed by the audit follow-up                                                                          |
| Phase 4 onboarding/dev audit typecheck    | Passed, 2026-07-27  | Repository-wide `tsc --noEmit` completed without errors after the onboarding/development audit follow-up and current runtime public API were integrated                                                                                              |
| Phase 4 onboarding/dev audit format       | Passed, 2026-07-27  | Prettier check passed for all onboarding, development-data recovery, development-navigation, status, and onboarding integration-test files changed by the audit follow-up                                                                            |
| Combined Phase 4 format check             | Passed, 2026-07-27  | `prettier --check .` completed with all repository files formatted                                                                                                                                                                                   |
| Combined Phase 4 lint                     | Passed, 2026-07-27  | `eslint .` completed without errors                                                                                                                                                                                                                  |
| Combined Phase 4 typecheck                | Passed, 2026-07-27  | `tsc --noEmit` completed without errors after the independent audit fixes                                                                                                                                                                            |
| Combined Phase 4 test suite               | Passed, 2026-07-27  | `vitest run`: 45 test files and 264 tests passed                                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-27  | Next.js 16.2.12 production build completed with `/enter`, `/customer/onboarding`, and gated development routes                                                                                                                                       |
| `npm run test:e2e`                        | Not run/recorded    | Await Playwright flows                                                                                                                                                                                                                               |
| Customer access focused tests             | Passed, 2026-07-28  | 3 Vitest tests passed for one-time claim redemption, stable private account link, wallet QR regeneration, and refreshed short-lived claim QR                                                                                                         |
| `npm run format`                          | Passed, 2026-07-28  | Prettier rewrote repository files after the customer-access implementation                                                                                                                                                                           |
| `npm run format:check`                    | Passed, 2026-07-28  | Repository-wide Prettier check completed with all matched files formatted                                                                                                                                                                            |
| `npm run lint`                            | Passed, 2026-07-28  | Repository-wide ESLint completed without errors after the customer-access implementation and hook dependency cleanup                                                                                                                                 |
| `npm run typecheck`                       | Passed, 2026-07-28  | Repository-wide `tsc --noEmit` completed after the customer-access implementation and narrow test mock type fixes                                                                                                                                    |
| `npm run test`                            | Passed, 2026-07-28  | Repository-wide Vitest suite passed: 60 test files and 324 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-28  | Next.js 16.2.12 production build completed with the admin tokener, claim, and private account routes                                                                                                                                                 |
| `npm run test:e2e`                        | Not run, 2026-07-28 | Playwright flows remain pending after this customer-access slice                                                                                                                                                                                     |
| Admin credential / QR-only tokener tests  | Passed, 2026-07-28  | 8 focused Vitest files and 33 tests passed for seeded super-admin username/password entry, QR-only tokener access, data version 4, and customer access service behaviour                                                                             |
| Numeric private-link update tests         | Passed, 2026-07-28  | Focused customer-access, local repository, local seed lifecycle, and development-data route tests passed after data version 5 numeric private-account link update                                                                                    |
| `npm run lint`                            | Passed, 2026-07-28  | Repository-wide ESLint completed after the admin credential and QR-only tokener updates                                                                                                                                                              |
| `npm run typecheck`                       | Passed, 2026-07-28  | Repository-wide `tsc --noEmit` completed after the admin credential and QR-only tokener updates                                                                                                                                                      |
| `npm run test`                            | Passed, 2026-07-28  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-28  | Next.js 16.2.12 production build completed with the admin credential entry and QR-only private account routes                                                                                                                                        |
| LAN phone preview                         | Passed, 2026-07-28  | `next dev` was restarted on `0.0.0.0:3000`; `/enter` returned HTTP 200 through `http://192.168.1.46:3000/enter`                                                                                                                                      |
| Supabase migration push                   | Passed, 2026-07-29  | `npx supabase link --project-ref infiighwjaajxlwzwkgd --password ... --yes` and `npx supabase db push --password ...` applied `20260728154615_initial_tokenly_schema.sql`; Docker-only migration catalog cache warning did not block the remote push |
| Supabase health endpoint                  | Passed, 2026-07-29  | `/api/supabase/health` returned HTTP 200 and verified 16 migrated tables with no table errors                                                                                                                                                        |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after ignoring Supabase CLI temp state and formatting the Supabase health route                                                                                                                             |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed after adding the Supabase server health route                                                                                                                                                                       |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after adding the Supabase server health route                                                                                                                                                               |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/api/supabase/health` as a dynamic server route                                                                                                                                                     |
| Supabase NRIC migration                   | Passed, 2026-07-29  | `npx supabase db push --password ...` applied `20260729101000_add_customer_nric.sql`; Docker-only migration catalog cache warning did not block the remote push                                                                                      |
| Supabase deployment API smoke             | Passed, 2026-07-29  | Prototype login cookie returned HTTP 200; authenticated admin tokeners API returned Lance Tan from Supabase; authenticated vendor customer-wallet resolver returned Lance Tan and balance 0                                                          |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                    |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                            |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after the Supabase deployment-prototype QR/admin changes                                                                                                                                                    |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 318 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with admin, customer-access, prototype-auth, and vendor dynamic API routes                                                                                                                                |
| Camera/credit wizard focused tests        | Passed, 2026-07-29  | 7 focused Vitest tests passed for visible scanner startup/scan states and the evidence-first, amount-second add-credits modal                                                                                                                        |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the vendor camera preview and evidence-backed credit issuance changes                                                                                                                                 |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors for the camera, modal, API, storage, and issuance changes                                                                                                                                            |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed without errors for the multipart evidence and atomic issuance path                                                                                                                                          |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 61 test files and 321 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with the updated vendor dashboard and admin tokener credit API                                                                                                                                            |
| Supabase localhost admin smoke            | Passed, 2026-07-29  | With `.env.local` loaded, prototype admin login returned HTTP 200, the hosted tokeners API returned 2 records, and the hosted transactions API returned an authenticated empty overview with zero groups                                             |
| Admin transaction focused tests           | Passed, 2026-07-29  | 2 RTL tests passed for connected zero metrics/empty activity and recoverable missing-Supabase-configuration handling                                                                                                                                 |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors after the Supabase admin transaction route and error-state changes                                                                                                                                   |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed without errors after adding the admin transaction read model and API                                                                                                                                        |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 62 test files and 323 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/admin/transactions` and `/api/admin/transactions`                                                                                                                                                  |
| Entry and development-route focused tests | Passed, 2026-07-29  | 13 focused Vitest tests passed for the two-panel login, access-QR parser, entry client, development navigation, and development route gate                                                                                                           |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the `/enter` redesign and removal of exposed development-data controls                                                                                                                                |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without warnings after the entry QR and development-tool cleanup                                                                                                                                                    |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed after regenerating route types without `/dev/data`                                                                                                                                                          |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 315 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with `/enter`, `/dev`, and `/dev/role-switcher`; `/dev/data` is absent from the emitted route table                                                                                                       |
| One-to-one credit focused tests           | Passed, 2026-07-29  | 7 focused modal tests passed, including S$50-to-50-token and S$0.50-to-0.5-token previews                                                                                                                                                            |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after the one-to-one conversion changes                                                                                                                                                                     |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors or warnings                                                                                                                                                                                          |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed with the rate enforcement and bootstrap repair                                                                                                                                                              |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 317 tests                                                                                                                                                                                     |
| `npm run build`                           | Passed, 2026-07-29  | Next.js 16.2.12 production build completed with the one-to-one admin credit issuance path                                                                                                                                                            |
| Fractional credit focused tests           | Passed, 2026-07-29  | 7 focused modal tests passed, including S$0.50-to-0.5-token submission                                                                                                                                                                               |
| `npm run format:check`                    | Passed, 2026-07-29  | Repository-wide Prettier check completed after fixed-decimal token support                                                                                                                                                                           |
| `npm run lint`                            | Passed, 2026-07-29  | Repository-wide ESLint completed without errors or warnings                                                                                                                                                                                          |
| `npm run typecheck`                       | Passed, 2026-07-29  | Repository-wide `tsc --noEmit` completed with fractional Supabase ledger amounts                                                                                                                                                                     |
| `npm run test`                            | Passed, 2026-07-29  | Repository-wide Vitest suite passed: 60 test files and 317 tests                                                                                                                                                                                     |
| `npm run build`                           | Environment blocked | Next.js could not unlink the existing OneDrive reparse-point directory `.next/static/dP88xmBa-KFHq-ebKPEg4` (`EPERM`); three retries produced the same filesystem error before compilation                                                           |

Replace “Not run/recorded” with the date, command, outcome, and concise failure limitation when a check is actually executed.

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
- Production deployment remains deferred until the full Supabase-backed runtime path, RLS policies, and Vercel environment configuration are completed and reviewed.

## Next work

Implement Phase 5 customer home, wallet/history, account QR, vendor
scan/directory/storefront, basket, PIN-confirmed purchase receipt, and event
help. Use only capability-specific read/mutation boundaries; repository handles
and PIN credentials remain private.

Apply and smoke-test the pending
`20260729143000_add_admin_credit_issuance.sql` and
`20260729161500_set_one_to_one_token_rate.sql` migrations against the connected
Supabase prototype before treating remote one-to-one evidence-backed credit
issuance as available outside the local development build.
