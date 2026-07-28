# Tokenly Product Definition

## Product summary

Tokenly is a mobile-first event token wallet for a two-day floorball event of approximately 500 attendees. Customers buy event tokens from staff after a staff member manually checks a PayNow payment, then spend those tokens with event vendors. Vendors can manage products, take token payments, refund orders, and review manually recorded settlements. Staff and administrators can trace every value-changing action.

The current deliverable is a **complete local prototype**. It must run without external accounts, API keys, hosted services, real payment verification, or deployment.

## Product goals

- Make a customer’s balance and next action immediately clear on a phone.
- Let staff issue tokens quickly without suggesting PayNow was verified automatically.
- Let vendors operate a small event storefront and reconcile token activity.
- Give administrators a traceable view from any transaction to its actor and related records.
- Preserve wallet integrity through an append-only ledger, idempotent mutations, and auditable actors.
- Keep persistence behind repository interfaces so local adapters can later be replaced by Supabase adapters.

## People and terminology

| Role          | Product responsibility                                                     | Primary layout               |
| ------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Customer      | Holds and spends event tokens; views receipts and refunds                  | Mobile-first                 |
| Vendor        | Manages a storefront, receives tokens, refunds orders, reviews settlements | Responsive operational UI    |
| Event staff   | Finds customers and issues tokens after manual payment checks              | Mobile/tablet-first          |
| Administrator | Inspects and configures the event, records settlements and adjustments     | Desktop-first, mobile-usable |

Use **Tokener** only in short, friendly customer-facing copy. Use **customer** in code, technical documents, staff/admin screens, audit records, exports, and system errors.

Definitions:

- **Token:** a positive integer event value unit. Fractional tokens do not exist.
- **Wallet:** an account-owned container whose balance is calculated from ledger entries.
- **Ledger entry:** an immutable debit or credit that contributes to a wallet balance.
- **Transaction group:** an identifier tying the records for one business operation together.
- **Evidence:** local prototype metadata for a PayNow screenshot captured or selected by staff.
- **Settlement:** an administrator-recorded vendor payout status; it never triggers a bank transfer.
- **PayNow amount:** a manually entered Singapore-dollar amount used to calculate issued tokens at the event’s configured rate.

## Core product principles

1. The wallet ledger is the only source of truth for balances.
2. Staff and administrators never directly edit a stored balance.
3. Every value-changing mutation records an actor and a unique idempotency key.
4. Purchases use current repository prices and availability, not client-supplied totals.
5. Refunds append reversing entries and never edit original entries.
6. The local prototype labels simulated and manual processes honestly.
7. Customer screens use minimal, warm language; operational records use precise language.
8. Mobile and desktop layouts are intentionally composed for their available space.

## Local prototype scope

### Authentication and onboarding

- Local super-admin entry with a seeded username and password.
- Locally persisted sessions and role-based route access.
- Four-digit wallet PIN setup and verification where required.
- Simulated lockout after repeated failures with generic failure messages.
- Tokeners do not use username, password, mobile-number, or PIN sign-in.
- Tokeners receive a one-time claim QR and then save a private account link.
- A development-only role switcher and data reset/reseed controls, enabled only by environment configuration.
- Clear disclosure that local operational credentials are prototype-only.

There is no SMS OTP, real mobile-number ownership verification, Supabase Auth, or production identity recovery.

### Customer experience

- Private account link with tokener name, current ledger-derived balance, and wallet QR.
- One-time claim QR that reveals the private account link once, then expires.
- Wallet QR regeneration that invalidates older wallet QR codes while keeping the private account link active.
- Account QR display and browser scanner/manual vendor-code entry.
- Vendor directory, storefront, products, basket, server-style price recalculation, PIN confirmation, and receipt.
- Transaction and refund history with loading, empty, error, and success states.

Preferred customer phrases include “Welcome to Tokenly”, “Welcome back, Tokener”, “Your wallet is ready”, “Scan to pay”, “Not enough tokens”, and “Enjoy your order”.

### Staff experience

- Dashboard metrics and warnings.
- Customer search, QR lookup, and development scan simulator.
- PayNow amount entry and token conversion using the configured rate.
- Local screenshot capture or upload with type and size validation.
- Optional payment reference and note, duplicate-reference warning, review, confirmation, receipt, ledger entry, and audit entry.
- Explicit copy that payment verification is a manual staff responsibility.

### Vendor experience

- Vendor profile, banner, logo, location, operating status, vendor QR, and storefront preview.
- Product create, edit, archive, restore, sold-out state, availability, and ordering.
- Dashboard metrics, orders, token transactions, full/partial refunds, and settlement history.
- Vendor PIN confirmation for prototype refunds.

### Administrator experience

- Dashboard metrics for issued, spent, held, refunded, unsettled, customer, vendor, and staff activity.
- Search and inspection across accounts, wallets, ledger entries, issuances, evidence, orders, refunds, settlements, and audit logs.
- Transaction tracing that connects actor, customer, vendor, order, evidence, ledger entries, refund, settlement, and audit records.
- Filtered CSV exports.
- Reasoned administrative adjustments.
- Event identity, token conversion rate, and support configuration.
- Manual vendor settlement records with draft, approved, and paid states.

### QR experience

- Customer and vendor QR display pages.
- Opaque QR identifiers or internal routes only.
- Browser scanner where supported, permission and unsupported states, manual entry, and a development simulator.
- QR payloads never contain a PIN, balance, permission, or private account detail.

## Seeded development scenario

Required entry accounts:

| Role          | Local username | Mobile number | Development PIN |
| ------------- | -------------- | ------------- | --------------- |
| Customer      | QR-only        | `90000001`    | `2468`          |
| Vendor        | Later          | `90000002`    | `2468`          |
| Event staff   | Later          | `90000003`    | `2468`          |
| Administrator | `AdminLance`   | `90000004`    | `2468`          |

At least one additional fictional customer, vendor account, and staff account must be seeded. The overall dataset includes at least three vendors (food and drinks, event merchandise, and floorball equipment), multiple products, issuances, purchases, one partial refund, one full refund, one settlement, and linked audit records. Never use real personal information.

The shared PIN is intentionally documented for development only. It must never become a production default.

## Experience and visual direction

- Pastel blue and pink accents on white and warm-white surfaces.
- Dark navy or charcoal text, generous whitespace, rounded cards, soft shadows, and layered panels.
- Large touch targets, visible focus, restrained motion, and reduced-motion support.
- Subtle original floorball-inspired geometry, such as perforations, court lines, or circular accents.
- Avoid neon colours, heavy black borders, sharp cards, excessive gradients, crowded dashboards, and borrowed brand styling.

Test major screens at 390 px, tablet widths, and 1280 px. Mobile uses stacked content, bottom navigation, full-width actions, and appropriate sheets. Desktop uses side navigation, multiple columns, persistent filters, tables, and detail panels where useful.

## Explicit non-goals for this deliverable

- Supabase-backed application runtime, authentication, Storage, row-level security, or production repository adapters
- Vercel setup, deployment, domains, or environment configuration
- GitHub publishing or automation
- SMS OTP and real mobile-number verification
- Real PayNow or banking verification
- Actual vendor payouts or bank transfers
- Production PIN hashing, distributed rate limiting, monitoring, or malware scanning
- Any claim that local evidence has been independently verified

These are production follow-up items, not partially implemented prototype features.

## Completion definition

The local prototype is complete only when functional flows, persistence/reset/reseed, responsive layouts, and required automated checks satisfy the completion criteria recorded in `docs/IMPLEMENTATION_PLAN.md`. Static screens alone do not meet this definition. `docs/IMPLEMENTATION_STATUS.md` is the authoritative record of what is actually implemented and verified.
