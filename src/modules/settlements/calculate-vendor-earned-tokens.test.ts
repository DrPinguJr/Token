import { describe, expect, it } from "vitest";

import type { LedgerEntry } from "@/modules/transactions";

import { calculateVendorEarnedTokens } from "./calculate-vendor-earned-tokens";

function createVendorEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "ledger-vendor-entry",
    walletId: "wallet-vendor-001",
    transactionGroupId: "transaction-purchase-001",
    entryType: "vendor_receipt",
    direction: "credit",
    tokenAmount: 30,
    actorAccountId: "account-customer-001",
    relatedCustomerId: "customer-001",
    relatedVendorId: "vendor-001",
    relatedOrderId: "order-001",
    relatedEvidenceId: null,
    reference: "ORD-001",
    description: "Vendor wallet credit for completed order.",
    occurredAt: "2026-07-25T10:00:00.000Z",
    idempotencyKey: "test:settlement:vendor-entry",
    metadata: {},
    reversesLedgerEntryId: null,
    ...overrides,
  };
}

describe("calculateVendorEarnedTokens", () => {
  it("subtracts vendor refunds from receipts in the authoritative ledger", () => {
    const ledgerEntries = [
      createVendorEntry(),
      createVendorEntry({
        id: "ledger-vendor-refund",
        transactionGroupId: "transaction-refund-001",
        entryType: "vendor_refund",
        direction: "debit",
        tokenAmount: 8,
        occurredAt: "2026-07-25T11:00:00.000Z",
        idempotencyKey: "test:settlement:vendor-refund",
        reversesLedgerEntryId: "ledger-vendor-entry",
      }),
      createVendorEntry({
        id: "ledger-other-vendor",
        walletId: "wallet-vendor-002",
        relatedVendorId: "vendor-002",
        tokenAmount: 100,
        idempotencyKey: "test:settlement:other-vendor",
      }),
      createVendorEntry({
        id: "ledger-wrong-wallet",
        walletId: "wallet-vendor-002",
        relatedVendorId: "vendor-001",
        tokenAmount: 70,
        idempotencyKey: "test:settlement:wrong-wallet",
      }),
      createVendorEntry({
        id: "ledger-adjustment",
        entryType: "administrative_adjustment",
        tokenAmount: 50,
        relatedOrderId: null,
        idempotencyKey: "test:settlement:adjustment",
      }),
    ];

    expect(
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries,
      }),
    ).toBe(22);
  });

  it("includes the start and excludes the end of a half-open period", () => {
    const ledgerEntries = [
      createVendorEntry({
        id: "ledger-at-start",
        occurredAt: "2026-07-25T00:00:00.000Z",
        tokenAmount: 10,
        idempotencyKey: "test:settlement:at-start",
      }),
      createVendorEntry({
        id: "ledger-before-end",
        occurredAt: "2026-07-25T23:59:59.999Z",
        tokenAmount: 20,
        idempotencyKey: "test:settlement:before-end",
      }),
      createVendorEntry({
        id: "ledger-at-end",
        occurredAt: "2026-07-26T00:00:00.000Z",
        tokenAmount: 40,
        idempotencyKey: "test:settlement:at-end",
      }),
    ];

    expect(
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries,
      }),
    ).toBe(30);
  });

  it("rejects an empty or reversed accounting period", () => {
    expect(() =>
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-26T00:00:00.000Z",
        periodEnd: "2026-07-25T00:00:00.000Z",
        ledgerEntries: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "SETTLEMENT_CALCULATION_INVALID_INPUT",
      }),
    );
  });

  it("rejects a refund whose reversal does not resolve to the original receipt", () => {
    const ledgerEntries = [
      createVendorEntry(),
      createVendorEntry({
        id: "ledger-broken-refund",
        transactionGroupId: "transaction-refund-broken",
        entryType: "vendor_refund",
        direction: "debit",
        tokenAmount: 5,
        occurredAt: "2026-07-25T11:00:00.000Z",
        idempotencyKey: "test:settlement:broken-refund",
        reversesLedgerEntryId: "ledger-receipt-missing",
      }),
    ];

    expect(() =>
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "SETTLEMENT_CALCULATION_INVALID_REFUND_REVERSAL",
      }),
    );
  });

  it("uses exact final-net arithmetic independent of intermediate order", () => {
    const maximumReceipt = createVendorEntry({
      id: "ledger-maximum-receipt",
      tokenAmount: Number.MAX_SAFE_INTEGER,
      relatedOrderId: "order-maximum",
      idempotencyKey: "test:settlement:maximum-receipt",
    });
    const oneTokenReceipt = createVendorEntry({
      id: "ledger-one-token-receipt",
      tokenAmount: 1,
      relatedOrderId: "order-one-token",
      idempotencyKey: "test:settlement:one-token-receipt",
    });
    const oneTokenRefund = createVendorEntry({
      id: "ledger-one-token-refund",
      transactionGroupId: "transaction-one-token-refund",
      entryType: "vendor_refund",
      direction: "debit",
      tokenAmount: 1,
      relatedOrderId: oneTokenReceipt.relatedOrderId,
      occurredAt: "2026-07-25T11:00:00.000Z",
      idempotencyKey: "test:settlement:one-token-refund",
      reversesLedgerEntryId: oneTokenReceipt.id,
    });

    expect(
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries: [maximumReceipt, oneTokenReceipt, oneTokenRefund],
      }),
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects an unsafe exact final settlement total", () => {
    const ledgerEntries = [
      createVendorEntry({
        id: "ledger-maximum-receipt",
        tokenAmount: Number.MAX_SAFE_INTEGER,
        relatedOrderId: "order-maximum",
        idempotencyKey: "test:settlement:maximum-receipt",
      }),
      createVendorEntry({
        id: "ledger-overflow-receipt",
        tokenAmount: 1,
        relatedOrderId: "order-overflow",
        idempotencyKey: "test:settlement:overflow-receipt",
      }),
    ];

    expect(() =>
      calculateVendorEarnedTokens({
        vendorId: "vendor-001",
        vendorWalletId: "wallet-vendor-001",
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "SETTLEMENT_CALCULATION_UNSAFE_TOTAL",
      }),
    );
  });
});
