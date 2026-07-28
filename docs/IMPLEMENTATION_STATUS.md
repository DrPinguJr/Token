# Tokenly Implementation Status

Last updated: 2026-07-27

## Summary

- **Current phase:** Phase 5 — Customer application
- **Overall status:** in progress
- **Current target:** complete local prototype
- **Infrastructure status:** Supabase, Vercel, GitHub publishing, and external integrations are deferred

This document records observed implementation, not intended scope. An item is complete only after its files exist and the relevant behaviour or command has been verified.

## Phase status

| Phase                              | Status      | Evidence                                                                                                                                                                                      |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation                      | Complete    | Tooling configured; install, lint, typecheck, unit smoke, build, and development-server root request passed                                                                                   |
| 2. Domain model                    | Complete    | Public domain contracts, versioned IndexedDB adapters, strict persistence boundaries, deterministic seed/reset/reseed, append-only audit handling, and combined validation are complete       |
| 3. Wallet foundation               | Complete    | Ledger semantics, issuance, purchase, refund, adjustment, settlement calculation, concurrency controls, atomic rollback, and the full validation gate passed                                  |
| 4. Authentication and onboarding   | Complete    | Local entry/runtime, role guards, one-time PIN setup, verification/lockout, onboarding, private capability boundaries, development tools, audit follow-up, and the combined gate passed         |
| 5. Customer application            | In progress | Customer wallet/history, commerce, QR/scanner, and help slices are in implementation                                                                                                           |
| 6. Staff application               | Not started | No completion evidence recorded                                                                                                                                                               |
| 7. Vendor application              | Not started | No completion evidence recorded                                                                                                                                                               |
| 8. Administrator application       | Not started | No completion evidence recorded                                                                                                                                                               |
| 9. Responsive/accessibility review | Not started | No completion evidence recorded                                                                                                                                                               |
| 10. Final validation               | Not started | No completion evidence recorded                                                                                                                                                               |

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

Phase 2 now includes public domain contracts for accounts, customers, wallets, ledger entries, token issuances, evidence, vendors, products, orders, refunds, settlements, event settings, and audit logs. Normal account reads are credential-free, with PIN credential and lockout state isolated behind a purpose-specific repository contract. Append-only records expose no update or delete operation, and wallet contracts expose no stored balance or `setBalance` operation.

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
copy for account lookup versus runtime/storage failures, and an explicit
disclosure that local mobile numbers are not verified and no SMS is sent; it
does not request a PIN.

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

Development tooling now includes `/dev/role-switcher` and `/dev/data`.
The role switcher lists active seeded accounts and uses the normal runtime
session API. Data reset and reset/reseed require the exact confirmation phrase,
optionally clear only the scoped Tokenly session/preferences, and reopen the
runtime safely with or without first-run initialization. The `/dev` route tree
returns not-found unless `NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS` is exactly
`true`; command boundaries retain the same strict environment gate.

The Phase 4 audit follow-up keeps onboarding failures behind stable
customer-safe copy and catches failed runtime retries. Development data
controls remain mounted and usable during loading/error recovery, preserving
success feedback across runtime context changes. Development navigation exposes
`aria-current="page"`, and fake-IndexedDB integration coverage proves configured
onboarding persistence plus rollback when its audit append fails.

## Validation record

| Command/check                            | Result             | Notes                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace inspection                     | Passed             | Workspace was initially empty except for Git metadata                                                                                                                                                  |
| `npm install`                            | Passed, 2026-07-27 | Lockfile created with Node 24.18.0 and npm 11.16.0                                                                                                                                                     |
| `npm run dev`                            | Passed, 2026-07-27 | Development server started; `/` returned HTTP 200                                                                                                                                                      |
| Targeted Prettier check                  | Passed, 2026-07-27 | Phase 1 application/configuration/test files                                                                                                                                                           |
| `npm run lint`                           | Passed, 2026-07-27 | ESLint completed without errors                                                                                                                                                                        |
| `npm run typecheck`                      | Passed, 2026-07-27 | Strict TypeScript completed without errors                                                                                                                                                             |
| `npm run test`                           | Passed, 2026-07-27 | Foundation Vitest suite: 1 test passed                                                                                                                                                                 |
| Targeted Phase 2 domain tests            | Passed, 2026-07-27 | 14 schema tests passed across shared primitives, ledger entries, orders, and settlements                                                                                                               |
| Targeted Phase 2 lint                    | Passed, 2026-07-27 | ESLint completed without errors for `src/modules`, shared types, and shared validation                                                                                                                 |
| Targeted Phase 2 seed/audit tests        | Passed, 2026-07-27 | 10 deterministic seed, cross-store integrity, reset facade, and append-only audit unit tests passed                                                                                                    |
| Phase 2 seed lifecycle integration tests | Passed, 2026-07-27 | 2 first-run metadata/idempotence and enabled development reseed tests passed against fake IndexedDB                                                                                                    |
| Targeted Phase 2 seed/audit lint         | Passed, 2026-07-27 | ESLint completed without errors for the seed, lifecycle, audit, and related integration-test files                                                                                                     |
| Targeted Phase 2 seed/audit format check | Passed, 2026-07-27 | Prettier check passed for the seed, lifecycle, audit, integration-test, and updated documentation files                                                                                                |
| Phase 2 repository integration tests     | Passed, 2026-07-27 | 15 IndexedDB schema, adapter, safety-boundary, isolation, unit-of-work, and concurrent initialization tests passed                                                                                     |
| Latest combined Phase 2 typecheck        | Passed, 2026-07-27 | Strict TypeScript completed without errors after persistence review fixes                                                                                                                              |
| Combined Phase 2 format check            | Passed, 2026-07-27 | `prettier --check .` completed with all repository files formatted                                                                                                                                     |
| Combined Phase 2 lint                    | Passed, 2026-07-27 | `eslint .` completed without errors                                                                                                                                                                    |
| Combined Phase 2 test suite              | Passed, 2026-07-27 | `vitest run`: 11 files and 45 tests passed                                                                                                                                                             |
| Phase 3 ledger/issuance typecheck        | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after the shared transaction and issuance slice                                                                                                |
| Phase 3 ledger/issuance targeted tests   | Passed, 2026-07-27 | 5 Vitest files and 26 tests passed, including duplicate idempotency/reference handling and IndexedDB rollback                                                                                          |
| Phase 3 ledger/issuance targeted lint    | Passed, 2026-07-27 | ESLint completed without errors for the ledger, transaction-provider, issuance, and integration-test slice                                                                                             |
| Phase 3 ledger/issuance format check     | Passed, 2026-07-27 | Prettier check passed for the ledger/issuance implementation, tests, public exports, and updated documentation                                                                                         |
| Phase 3 integrity follow-up tests        | Passed, 2026-07-27 | 10 Vitest files and 85 tests passed across ledger semantics, issuance authorization/tamper cases, seed v2, and IndexedDB lifecycle                                                                     |
| Phase 3 integrity follow-up typecheck    | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after the compatibility and collision changes                                                                                                  |
| Phase 3 integrity follow-up lint         | Passed, 2026-07-27 | Targeted ESLint completed without errors for all files changed by the integrity follow-up                                                                                                              |
| Phase 3 integrity follow-up format check | Passed, 2026-07-27 | Targeted Prettier check passed for all changed implementation, test, seed, lifecycle, and documentation files                                                                                          |
| Combined Phase 3 format check            | Passed, 2026-07-27 | `prettier --check .` completed with all repository files formatted                                                                                                                                     |
| Combined Phase 3 lint                    | Passed, 2026-07-27 | `eslint .` completed without errors                                                                                                                                                                    |
| Combined Phase 3 typecheck               | Passed, 2026-07-27 | `tsc --noEmit` completed without errors                                                                                                                                                                |
| Combined Phase 3 test suite              | Passed, 2026-07-27 | `vitest run`: 23 files and 164 tests passed, including atomic rollback and concurrent wallet mutation coverage                                                                                         |
| Phase 4 auth/runtime focused tests       | Passed, 2026-07-27 | 36 unit and RTL tests passed for mobile normalization, generic entry failures, role destinations/permissions, minimal session storage, runtime initialization/switching, sign-out, and `/enter` states |
| Phase 4 auth IndexedDB integration tests | Passed, 2026-07-27 | 2 tests passed for atomic active-customer entry/audit and unknown-account rejection                                                                                                                    |
| Phase 4 auth/runtime targeted lint       | Passed, 2026-07-27 | ESLint completed without errors for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                             |
| Phase 4 auth/runtime format check        | Passed, 2026-07-27 | Prettier check passed for authentication, runtime/PIN composition, `/enter`, root composition, and focused tests                                                                                       |
| Phase 4 auth/runtime typecheck           | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after the combined Phase 4 composition                                                                                                         |
| Phase 4 auth audit follow-up tests       | Passed, 2026-07-27 | 7 files and 24 tests passed for private runtime boundaries, gated account discovery/switching, safe entry errors, single redirect ownership, IndexedDB lifecycle, and rapid reload/unmount cleanup     |
| Phase 4 auth audit follow-up lint        | Passed, 2026-07-27 | Targeted ESLint completed without errors for the authentication/runtime, configured account query, `/enter`, and role-switcher follow-up                                                               |
| Phase 4 auth audit follow-up format      | Passed, 2026-07-27 | Targeted Prettier check completed successfully for all follow-up implementation and test files                                                                                                         |
| Phase 4 auth audit follow-up typecheck   | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after removing public repository handles                                                                                                       |
| Phase 4 PIN targeted tests               | Passed, 2026-07-27 | 12 unit and 3 IndexedDB integration tests passed, including seed digest compatibility, validation, lock timing, rollback, safe audits, setup/change, reset, and concurrent wrong attempts              |
| Phase 4 PIN targeted lint                | Passed, 2026-07-27 | ESLint completed without errors for the PIN schemas, service, prototype credential derivation, and unit/integration tests                                                                              |
| Phase 4 PIN repository typecheck         | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after the Phase 4 PIN public API and local composition were integrated                                                                         |
| Phase 4 onboarding/dev targeted tests    | Passed, 2026-07-27 | 10 Vitest files and 32 tests passed across atomic onboarding and rollback, the four-step RTL flow, role redirects/switching, strict route gating, confirmed reset/reseed, and runtime reload           |
| Phase 4 onboarding/dev targeted lint     | Passed, 2026-07-27 | ESLint completed without errors for the onboarding module/routes, developer-tool module/routes, configuration boundaries, and focused tests                                                            |
| Phase 4 onboarding/dev typecheck         | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after onboarding and development-tool runtime composition                                                                                      |
| Phase 4 onboarding/dev format check      | Passed, 2026-07-27 | Prettier check passed for the onboarding and development-tool implementation, routes, tests, configuration, global motion style, test setup, and status documentation                                  |
| Phase 4 onboarding/dev audit tests       | Passed, 2026-07-27 | 10 focused Vitest files and 35 tests passed, including safe failure copy, caught retry rejection, runtime-error reset/reseed, feedback persistence, active navigation, and IndexedDB audit rollback    |
| Phase 4 onboarding/dev audit lint        | Passed, 2026-07-27 | ESLint completed without errors for all onboarding, development-data recovery, development-navigation, and onboarding integration-test files changed by the audit follow-up                            |
| Phase 4 onboarding/dev audit typecheck   | Passed, 2026-07-27 | Repository-wide `tsc --noEmit` completed without errors after the onboarding/development audit follow-up and current runtime public API were integrated                                                |
| Phase 4 onboarding/dev audit format      | Passed, 2026-07-27 | Prettier check passed for all onboarding, development-data recovery, development-navigation, status, and onboarding integration-test files changed by the audit follow-up                              |
| Combined Phase 4 format check            | Passed, 2026-07-27 | `prettier --check .` completed with all repository files formatted                                                                                                                                    |
| Combined Phase 4 lint                    | Passed, 2026-07-27 | `eslint .` completed without errors                                                                                                                                                                    |
| Combined Phase 4 typecheck               | Passed, 2026-07-27 | `tsc --noEmit` completed without errors after the independent audit fixes                                                                                                                              |
| Combined Phase 4 test suite              | Passed, 2026-07-27 | `vitest run`: 45 test files and 264 tests passed                                                                                                                                                        |
| `npm run build`                          | Passed, 2026-07-27 | Next.js 16.2.12 production build completed with `/enter`, `/customer/onboarding`, and gated development routes                                                                                         |
| `npm run test:e2e`                       | Not run/recorded   | Await Playwright flows                                                                                                                                                                                 |

Replace “Not run/recorded” with the date, command, outcome, and concise failure limitation when a check is actually executed.

## Known limitations

- Product routes beyond the completed entry, onboarding, and development surfaces remain unavailable until their ordered role-application phases are implemented.
- The local prototype does not provide verified identity, verified payment, server-enforced authorization, or production-grade PIN security.
- Browser-local storage is editable by the browser user and unsuitable as a production wallet authority.
- Local data version `1` requires an explicit development reset/reseed before it can be opened under the version `2` ledger semantics.
- Phase 2 IndexedDB integration tests use fake IndexedDB with a Blob-compatible Node shim; real-browser persistence and refresh behaviour remain an end-to-end validation responsibility.
- Production services and deployment are intentionally deferred.

## Next work

Implement Phase 5 customer home, wallet/history, account QR, vendor
scan/directory/storefront, basket, PIN-confirmed purchase receipt, and event
help. Use only capability-specific read/mutation boundaries; repository handles
and PIN credentials remain private.
