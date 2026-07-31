# ADR 0002: Append-only paired wallet entries and calculated balances

- Status: Accepted
- Date: 2026-07-27

## Context

Tokenly moves event tokens among customer and vendor wallets. Staff issue tokens, customers purchase products, administrators refund vendor transactions, administrators record settlements, and administrators may make reasoned adjustments. Directly stored/editable balances make it difficult to trace an error, prevent accidental overwrites, reverse a transaction safely, or explain a wallet total.

The product requires immutable ledger history, idempotency, non-negative wallets, actor attribution, refunds that preserve originals, and transaction tracing.

## Decision

The ledger is the sole source of wallet balances.

- A wallet balance is calculated as credits minus debits.
- There is no stored editable balance and no `setBalance` repository method.
- Ledger entries are append-only and cannot be edited or deleted.
- Every entry records a positive fixed-decimal token amount with at most two
  decimal places, direction, type, wallet, actor, transaction-group ID,
  timestamp, idempotency key, safe reference/description, and relevant
  relationships.
- Purchases create a customer debit and equal vendor credit in one transaction group.
- Refunds create a customer credit and equal vendor debit, linked to the original entries.
- Issuances create explicit customer credits and preserve evidence, amount, conversion rate, and staff actor.
- Administrative adjustments are explicit credit/debit entries with a required reason.
- A local transaction service validates all proposed entries and records before one IndexedDB transaction commits them.
- Duplicate idempotency keys, overdraws, invalid amounts, and over-refunds abort the complete operation.

“Double-entry” here means paired, value-conserving entries for transfers between Tokenly wallets. Issuance and adjustment are explicit sources/corrections, not hidden balancing entries. Future production accounting may introduce system/clearing wallets if reconciliation requirements demand them.

## Consequences

### Positive

- Every displayed balance can be reconstructed and explained.
- Purchases/refunds conserve token value across customer and vendor wallets.
- Originals remain available for dispute and audit review.
- Idempotency protects against duplicate taps and retries.
- Transaction-group queries can reconstruct a complete business event.

### Trade-offs

- Balance reads require aggregation or a safely derived cache in future production.
- Refund and settlement calculations must query prior records.
- Atomicity across several stores requires a deliberately designed IndexedDB transaction coordinator.
- Local data remains user-editable and cannot provide production trust.

## Rejected alternatives

- **Mutable balance field:** fast to read but vulnerable to drift and untraceable edits.
- **Editing a purchase entry during refund:** destroys the original record and weakens auditability.
- **One unpaired transfer record:** obscures per-wallet direction and complicates wallet-level queries.
- **Client-displayed total as authoritative:** permits stale or manipulated pricing.

## Invariants to test

- Balance calculation.
- Equal debit/credit totals for purchase and refund groups.
- Non-negative resulting wallets.
- Unique idempotency keys.
- Positive fixed-decimal token amounts with at most two decimal places.
- Original preservation and reversal relationship.
- Cumulative refunds no greater than the order total.
- Actor and audit record present in every committed mutation.
