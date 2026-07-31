# Tokenly Architecture

## Architecture style

Tokenly is a **feature-first modular monolith using vertical slices, explicit module boundaries, and a replaceable repository layer**.

The local prototype runs as one Next.js App Router application. Business capabilities live in modules; route files compose those capabilities. IndexedDB is the persistent local adapter. Future Supabase adapters must implement the same repository contracts rather than forcing business services to know about SQL or Supabase clients.

## High-level runtime

```text
Next.js route/layout
  -> feature component / form
    -> Zod boundary validation
      -> application service
        -> repository interfaces
          -> IndexedDB adapters

Application service
  -> domain rules
  -> local transaction coordinator
  -> audit service
```

Client boundaries matter in a local-first browser prototype. IndexedDB adapters are browser-only. Server components may render static shell content, but any browser persistence must be reached through a client entry point. A client component must not import server-only modules.

## Project layout

```text
src/
├── app/
│   ├── (public)/
│   ├── (customer)/
│   ├── (vendor)/
│   ├── (staff)/
│   ├── (admin)/
│   └── api/
├── modules/
│   ├── authentication/
│   ├── onboarding/
│   ├── accounts/
│   ├── customers/
│   ├── wallets/
│   ├── transactions/
│   ├── token-issuance/
│   ├── vendors/
│   ├── products/
│   ├── orders/
│   ├── qr-payments/
│   ├── refunds/
│   ├── settlements/
│   ├── evidence/
│   ├── event-settings/
│   └── audit-logs/
├── shared/
│   ├── components/
│   ├── data/
│   ├── validation/
│   ├── security/
│   ├── formatting/
│   ├── constants/
│   └── types/
└── config/
```

Create only folders a substantial module actually needs:

```text
src/modules/wallets/
├── components/
├── actions/
├── queries/
├── services/
├── repositories/
├── schemas/
├── types/
├── tests/
└── index.ts
```

Do not create placeholder folders to imitate the diagram.

## Module contracts

Each module exposes its supported surface from `index.ts`. Other modules must not import internal paths.

A typical vertical slice has:

- **Schemas:** Zod schemas for input at trust boundaries.
- **Types:** domain types owned by the capability.
- **Repositories:** interfaces and local adapter implementations.
- **Services:** business operations and invariant enforcement.
- **Queries:** read models derived through repositories.
- **Actions:** thin orchestration for a UI boundary when needed.
- **Components:** feature-specific presentation; no core business logic.
- **Tests:** rules and contract coverage colocated with the module.

Shared code is capability-neutral and cannot import any module. A module may depend on shared primitives. Circular module dependencies are not allowed; move only genuinely neutral concepts downward or define an explicit public contract.

## Route responsibility

Pages, layouts, and route handlers:

- select the role-appropriate shell;
- parse route parameters;
- invoke a module public API;
- map a service result to UI or HTTP state;
- remain free of pricing, balance, refund, or permission rules.

Route groups separate public, customer, vendor, staff, and administrator composition without changing public URLs.

## Data access and repositories

All persistent reads and writes go through interfaces. React components and business services do not issue raw IndexedDB operations.

Required repository contracts:

- `AccountRepository`
- `WalletRepository`
- `LedgerEntryRepository`
- `TokenIssuanceRepository`
- `EvidenceRepository`
- `VendorRepository`
- `ProductRepository`
- `OrderRepository`
- `RefundRepository`
- `SettlementRepository`
- `AuditLogRepository`
- `EventSettingsRepository`

Repository interfaces use domain values rather than IndexedDB-specific requests or Supabase response shapes. IDs are opaque strings. Mutation services supply timestamps and IDs through injectable providers where deterministic tests benefit.

There is deliberately no `setBalance` method. Wallet reads calculate:

```text
balance = sum(credit amounts) - sum(debit amounts)
```

## Atomic local mutations

IndexedDB supports transactions across object stores in one database. A single application transaction coordinator must:

1. validate the complete command with Zod;
2. load authoritative repository data;
3. calculate prices, remaining refundable amounts, and wallet balances;
4. validate every proposed record and invariant;
5. reject an already-used idempotency key;
6. prepare all linked records with one transaction-group ID;
7. commit the records in one IndexedDB transaction;
8. return a receipt/read model only after commit.

If validation fails, no record is committed. If the transaction aborts, no partial operation is reported as successful.

## Wallet operation groups

### Issuance

- one issuance record;
- evidence metadata where required;
- one customer wallet credit;
- one audit entry.

The record preserves the manual PayNow amount, conversion rate, token amount, actor, reference, and evidence relationship.

### Purchase

- one immutable completed order with line-item price snapshots;
- one customer wallet debit;
- one vendor wallet credit;
- one audit entry.

The service reloads products and prices, validates availability and quantity, verifies PIN, checks balance, and rejects duplicate submissions.

### Refund

- one refund record;
- one customer wallet credit;
- one vendor wallet debit;
- one audit entry.

Refunds are administrator-recorded.

Entries reference their originals. The original order and ledger entries remain unchanged. Cumulative refunds cannot exceed the order’s refundable token total, and the vendor wallet cannot go below zero.

### Administrative adjustment

- one credit or debit ledger entry;
- one audit entry;
- mandatory reason and administrator actor.

The service applies the same positive-integer, idempotency, and non-negative-balance rules.

### Settlement

A settlement is an administrator-recorded business record with draft, approved, or paid status. It does not transfer money. Any ledger representation must follow the documented settlement calculation and must not be confused with a bank transaction. All status changes append audit entries.

## Authentication and authorization

The prototype uses local accounts and a locally persisted session. `/enter` is for operational accounts only; the seeded super-admin uses local username/password credentials. Tokeners do not authenticate through `/enter`; they receive a one-time claim QR and then use their saved private account link. Role guards control route and command access, while services re-check actor permission for sensitive mutations.

PIN verification sits behind `PinVerificationService`. The UI never logs a PIN or retains it in normal application state longer than a verification attempt. Simulated lockout is local prototype behaviour, not production-grade rate limiting or hashing.

Development role/data tools are compiled into the local prototype but are unreachable unless an explicit public development flag is enabled. They must remain visibly labelled and must never be presented as production administration.

## QR architecture

QR payloads contain an opaque public code or an internal route carrying that code. Resolution happens through a repository query. Payloads never embed balances, PINs, roles/permissions, mobile numbers, or private profile data.

Scanning has four adapters/states:

- supported browser camera scanner;
- camera permission request/denied state;
- unsupported/failed scanner state with manual input;
- environment-gated seeded-record simulator.

All paths produce the same validated opaque code before lookup.

## Errors and result handling

Services return typed success/failure results or throw narrowly typed domain errors at a documented boundary. UI maps them to:

- generic PIN/authentication failures;
- actionable validation messages for safe input fields;
- conflict/idempotency messages that discourage resubmission;
- a recoverable storage error when IndexedDB is unavailable.

Internal errors must not include PINs, evidence bytes, secrets, or unnecessary private details. Audit failures in a value-changing transaction abort that transaction rather than creating untracked value.

## Replaceability and future hosting

The future production migration replaces:

- local session/account verification with Supabase Auth-backed identity;
- every IndexedDB repository adapter with a Supabase database adapter;
- local evidence metadata/blob handling with Supabase Storage plus validated metadata;
- local transaction coordination with server-side database transactions/functions;
- prototype role checks with server enforcement and row-level security;
- local PIN simulation with server-side hashing, throttling, and monitoring.

Domain service contracts, Zod command schemas, transaction-group semantics, and most UI read models should remain stable. See `supabase/README.md` and the non-executable `supabase/planned-schema.sql`.

## Architectural decisions

Decision records live under `docs/DECISIONS`. Start with:

- `0001-local-first-modular-monolith.md` — local-first modular monolith and repository boundary.
- `0002-append-only-double-entry-wallet-groups.md` — append-only paired wallet entries and calculated balances.

Update or supersede an ADR when a consequential decision changes; do not silently contradict it in code.
