# Tokenly Implementation Plan

## Delivery state

- **Target:** complete local prototype
- **Current phase:** Phase 5 — Customer application
- **Status:** Phases 1–4 complete; Phase 5 in progress
- **Production infrastructure:** deferred

The phases below are ordered dependencies, not parallel feature buckets. Later UI may be scaffolded for shared shell validation, but payment UI must not be treated as ready until the wallet rules and tests in Phase 3 pass.

## Dependency map

```text
Phase 1 Foundation
  -> Phase 2 Domain model and repositories
    -> Phase 3 Wallet foundation
      -> Phase 4 Authentication and onboarding
        -> Phase 5 Customer application
        -> Phase 6 Staff application
        -> Phase 7 Vendor application
          -> Phase 8 Administrator application
            -> Phase 9 Responsive/accessibility review
              -> Phase 10 Final validation
```

The role applications share Phase 4 authentication. Staff issuance, customer purchases, vendor refunds, settlements, and administrator tracing depend on the Phase 2 data model and Phase 3 transaction rules.

## Phase 1 — Foundation

### Outcome

A strict, locally runnable Next.js project with a documented architecture, shared design tokens and responsive application shells, and working quality tooling.

### Tasks

- [x] Inspect the initial workspace.
- [x] Initialise Next.js App Router with strict TypeScript and npm.
- [x] Install and configure Tailwind CSS, ESLint, and Prettier.
- [x] Install and configure Vitest and React Testing Library.
- [x] Install and configure Playwright.
- [x] Add React Hook Form, Zod, Lucide, and maintained QR libraries.
- [x] Create `AGENTS.md`.
- [x] Create the initial documentation set and decision record.
- [x] Create shared design tokens and an original Tokenly event mark.
- [x] Build mobile and desktop responsive shells.
- [x] Verify `npm install`, development server startup, and production build.
- [x] Record actual validation results in `docs/IMPLEMENTATION_STATUS.md`.

Do not mark unchecked items complete without verifying the repository state.

## Phase 2 — Domain model and local repositories

### Depends on

Phase 1 project/tooling foundation.

### Tasks

- [x] Define domain types and Zod boundary schemas.
- [x] Define repository interfaces for accounts, wallets, ledger entries, token issuances, evidence, vendors, products, orders, refunds, settlements, audit logs, and event settings.
- [x] Implement versioned IndexedDB adapters behind those interfaces.
- [x] Build realistic, fictional seed data and first-run seeding.
- [x] Add development-only data reset and reseed.
- [x] Implement an append-only audit service.
- [x] Keep persistence and seeding outside React components.

## Phase 3 — Wallet foundation

### Depends on

Phase 2 repository contracts and persistence.

### Tasks

- [x] Implement immutable ledger entries and calculated balances.
- [x] Reject non-positive/fractional token amounts and duplicate idempotency keys.
- [x] Implement a single local transaction service that validates all writes before one IndexedDB commit.
- [x] Implement token issuance, repository-price purchase, full/partial refund, and reasoned administrative adjustment services.
- [x] Prevent overdraft, duplicate submission, unavailable purchases, completed-order edits, and over-refunds.
- [x] Preserve reversal relationships and transaction-group traceability.
- [x] Add required unit and integration tests.

**Gate:** wallet invariants and tests must pass before payment UI is built.

Gate passed on 2026-07-27: formatting, lint, strict TypeScript, 164 unit/integration tests, and the production build completed successfully. Independent review found no remaining Phase 3 integrity defect.

## Phase 4 — Authentication and onboarding

### Depends on

Phase 2 accounts/audit repositories and stable wallet ownership; Phase 3 for PIN-protected value flows.

### Tasks

- [x] Implement local mobile-number account entry and persisted sessions.
- [x] Implement role permission guards.
- [x] Add `PinVerificationService`, PIN setup, verification, and simulated lockout.
- [x] Keep plain-text PINs out of normal application state, logs, errors, and audit metadata.
- [x] Implement customer onboarding independently from authentication.
- [x] Add the environment-gated role switcher and development data tools.

Gate passed on 2026-07-27 after independent boundary review and follow-up:
repository handles remain private, development switching is gated at the
service boundary, PIN setup is a one-time transition from an explicit
unconfigured state, and onboarding/reset recovery uses safe error handling.
Formatting, lint, strict TypeScript, 264 unit/integration/RTL tests, and the
production build completed successfully.

## Phase 5 — Customer application

### Depends on

Phases 2–4.

### Tasks

- Customer home and dominant wallet card.
- Account QR, vendor scan/manual entry, and scan simulator.
- Vendor list and storefront.
- Basket, review, PIN confirmation, purchase, and receipt.
- Transaction/refund history and event help.
- Loading, empty, error, and success states.

## Phase 6 — Staff application

### Depends on

Phases 2–4 and the token-issuance service.

### Tasks

- Staff dashboard, customer search, and QR customer lookup.
- Manual PayNow check disclosure, amount conversion, evidence upload/capture, and file validation.
- Duplicate-reference warning, review, confirmation, receipt, and issuance history.
- Verify linked evidence, ledger, issuance, and audit records.

## Phase 7 — Vendor application

### Depends on

Phases 2–5 and refund/settlement contracts.

### Tasks

- Vendor dashboard and profile editor.
- Product create/edit/archive/restore, availability, sold-out, and reorder controls.
- Vendor QR and storefront preview.
- Transaction history and PIN-confirmed full/partial refund flow.
- Settlement history and manual-record disclosure.

## Phase 8 — Administrator application

### Depends on

All prior domain flows, so linked records exist to inspect.

### Tasks

- Dashboard and searchable/filterable account and activity views.
- Ledger, issuance, evidence, order, refund, settlement, and audit inspection.
- Transaction trace connecting all related records.
- Filtered CSV export.
- Manual settlement recording and status changes.
- Event/support/rate settings.
- Reasoned administrative adjustments.

## Phase 9 — Responsive and accessibility review

### Depends on

All major screens implemented.

### Tasks

- Test major screens at 390 px, tablet, and 1280 px.
- Fix overflow and verify deliberate mobile/desktop composition.
- Verify touch-target size, keyboard navigation, focus state, dialog semantics, and colour contrast.
- Verify animations respect reduced-motion preferences.

## Phase 10 — Final validation

### Depends on

All product phases and review fixes.

Run, fix, and record:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Also verify:

- `npm install` succeeds from a clean dependency state.
- `npm run dev` starts the application.
- IndexedDB data survives refresh and can be reset and reseeded.
- Customer onboarding, wallet, account QR, and purchase work.
- Vendor QR, product management, refund, and settlement history work.
- Staff issuance and local evidence attachment work.
- Administrator transaction tracing works.
- Mobile and desktop layouts are usable.
- Documentation matches implementation.
- No unexplained TODO remains in a critical wallet flow.

At completion, update `README.md`, `docs/LOCAL_DEVELOPMENT.md`, this plan, and `docs/IMPLEMENTATION_STATUS.md` with exact commands and results.

## Testing expectations

### Unit

- Ledger balance calculation
- Token issuance
- Repository-price recalculation
- Insufficient-balance prevention
- Duplicate-idempotency prevention
- PIN validation and simulated lockout
- Full and partial refunds
- Over-refund prevention
- Administrative-adjustment validation
- Vendor-settlement calculation

### Integration

- Issuance creates evidence, ledger, and audit records.
- Purchase creates order, customer debit, vendor credit, and audit records.
- Refund creates reversing entries and preserves originals.
- Transaction trace returns all linked records.

### Playwright

1. Customer enters, views wallet, and completes a simulated purchase.
2. Staff finds a customer and issues tokens with mock evidence.
3. Vendor updates a product and reviews a payment.
4. Administrator searches for a transaction and traces linked records.

Tests should exercise services and repository contracts, not duplicate internal implementation. IndexedDB integration tests use isolated databases. End-to-end tests reset/reseed deterministic local data before each scenario.

## Deferred infrastructure work

The local prototype must not configure:

- Supabase authentication, database, Storage, migrations, or row-level security
- Production PIN hashing or distributed rate limiting
- SMS OTP or real mobile-number ownership verification
- Real PayNow verification, banking integration, or vendor payouts
- Evidence malware scanning
- Production monitoring
- Vercel, custom domains, or hosted environment variables
- GitHub publishing or automation

The intended Supabase schema is planning-only in `supabase/planned-schema.sql`. Future adapter replacements are listed in `supabase/README.md`.

## Completed work

At initial foundation documentation time:

- The empty workspace was inspected.
- Repository guidance and foundational product/architecture documentation were created.
- Local-versus-production boundaries and the future schema were documented.
- The Next.js App Router application and required quality tooling were configured.
- The Tokenly design tokens, original mark, and responsive public/dashboard shells were implemented.
- Dependency installation, lint, strict typechecking, unit smoke test, production build, and a live development-server root request were verified on 2026-07-27.

Implementation work and validation must be reflected in `docs/IMPLEMENTATION_STATUS.md` as it occurs.

Phase 2 completed on 2026-07-27 with strict evidence/audit boundaries,
credential-isolated account access, atomic first-run persistence, deterministic
cross-store seed integrity, and green repository-wide formatting, lint,
typecheck, unit/integration test, and production-build checks.

## Remaining work

Phases 3–10 remain. Phase 3 must implement and verify wallet invariants before
payment UI work begins.
