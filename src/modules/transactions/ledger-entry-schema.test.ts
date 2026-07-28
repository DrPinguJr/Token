import { describe, expect, it } from "vitest";

import { ledgerEntrySchema } from "@/modules/transactions";

const validLedgerEntry = {
  id: "ledger-001",
  walletId: "wallet-001",
  transactionGroupId: "group-001",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 20,
  actorAccountId: "account-staff-001",
  relatedCustomerId: "customer-001",
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: "evidence-001",
  reference: "ISS-001",
  description: "Manual token issuance recorded by event staff.",
  occurredAt: "2026-07-27T01:00:00.000Z",
  idempotencyKey: "issuance-001",
  metadata: { manualPaymentCheck: true },
  reversesLedgerEntryId: null,
} as const;

const validEntrySemantics = [
  {
    entryType: "token_issuance",
    direction: "credit",
    relatedCustomerId: "customer-001",
    relatedVendorId: null,
    relatedOrderId: null,
    relatedEvidenceId: "evidence-001",
    reversesLedgerEntryId: null,
  },
  {
    entryType: "customer_purchase",
    direction: "debit",
    relatedCustomerId: "customer-001",
    relatedVendorId: "vendor-001",
    relatedOrderId: "order-001",
    relatedEvidenceId: null,
    reversesLedgerEntryId: null,
  },
  {
    entryType: "vendor_receipt",
    direction: "credit",
    relatedCustomerId: "customer-001",
    relatedVendorId: "vendor-001",
    relatedOrderId: "order-001",
    relatedEvidenceId: null,
    reversesLedgerEntryId: null,
  },
  {
    entryType: "customer_refund",
    direction: "credit",
    relatedCustomerId: "customer-001",
    relatedVendorId: "vendor-001",
    relatedOrderId: "order-001",
    relatedEvidenceId: null,
    reversesLedgerEntryId: "ledger-customer-purchase-001",
  },
  {
    entryType: "vendor_refund",
    direction: "debit",
    relatedCustomerId: "customer-001",
    relatedVendorId: "vendor-001",
    relatedOrderId: "order-001",
    relatedEvidenceId: null,
    reversesLedgerEntryId: "ledger-vendor-receipt-001",
  },
  {
    entryType: "vendor_settlement",
    direction: "debit",
    relatedCustomerId: null,
    relatedVendorId: "vendor-001",
    relatedOrderId: null,
    relatedEvidenceId: null,
    reversesLedgerEntryId: null,
  },
  {
    entryType: "administrative_adjustment",
    direction: "credit",
    relatedCustomerId: null,
    relatedVendorId: null,
    relatedOrderId: null,
    relatedEvidenceId: null,
    reversesLedgerEntryId: null,
  },
] as const;

describe("ledgerEntrySchema", () => {
  it("accepts a traceable append-only ledger record", () => {
    expect(ledgerEntrySchema.safeParse(validLedgerEntry).success).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects invalid token amount %s", (tokenAmount) => {
    expect(
      ledgerEntrySchema.safeParse({
        ...validLedgerEntry,
        tokenAmount,
      }).success,
    ).toBe(false);
  });

  it("rejects records without an actor or with unknown persisted fields", () => {
    expect(
      ledgerEntrySchema.safeParse({
        ...validLedgerEntry,
        actorAccountId: undefined,
      }).success,
    ).toBe(false);
    expect(
      ledgerEntrySchema.safeParse({
        ...validLedgerEntry,
        balance: 20,
      }).success,
    ).toBe(false);
  });

  it.each(validEntrySemantics)(
    "accepts the required $entryType relationships",
    (semantics) => {
      expect(
        ledgerEntrySchema.safeParse({
          ...validLedgerEntry,
          ...semantics,
        }).success,
      ).toBe(true);
    },
  );

  it.each([
    {
      name: "issuance debit",
      semantics: { ...validEntrySemantics[0], direction: "debit" },
    },
    {
      name: "issuance without evidence",
      semantics: {
        ...validEntrySemantics[0],
        relatedEvidenceId: null,
      },
    },
    {
      name: "issuance reversal",
      semantics: {
        ...validEntrySemantics[0],
        reversesLedgerEntryId: "ledger-original-001",
      },
    },
    {
      name: "customer purchase without vendor",
      semantics: {
        ...validEntrySemantics[1],
        relatedVendorId: null,
      },
    },
    {
      name: "vendor receipt debit",
      semantics: { ...validEntrySemantics[2], direction: "debit" },
    },
    {
      name: "customer refund without reversal",
      semantics: {
        ...validEntrySemantics[3],
        reversesLedgerEntryId: null,
      },
    },
    {
      name: "vendor refund credit",
      semantics: { ...validEntrySemantics[4], direction: "credit" },
    },
    {
      name: "settlement with customer relationship",
      semantics: {
        ...validEntrySemantics[5],
        relatedCustomerId: "customer-001",
      },
    },
    {
      name: "adjustment reversal",
      semantics: {
        ...validEntrySemantics[6],
        reversesLedgerEntryId: "ledger-original-001",
      },
    },
  ])("rejects semantic mismatch: $name", ({ semantics }) => {
    expect(
      ledgerEntrySchema.safeParse({
        ...validLedgerEntry,
        ...semantics,
      }).success,
    ).toBe(false);
  });

  it("allows either direction for a non-reversing administrative adjustment", () => {
    expect(
      ledgerEntrySchema.safeParse({
        ...validLedgerEntry,
        ...validEntrySemantics[6],
        direction: "debit",
      }).success,
    ).toBe(true);
  });
});
