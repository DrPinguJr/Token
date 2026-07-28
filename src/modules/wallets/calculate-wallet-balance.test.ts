import { describe, expect, it } from "vitest";

import {
  InvalidTokenAmountError,
  WalletBalanceOverflowError,
  type LedgerDirection,
  type LedgerEntry,
} from "@/modules/transactions";

import { calculateWalletBalance } from "./calculate-wallet-balance";

function createEntry(
  id: string,
  direction: LedgerDirection,
  tokenAmount: number,
): LedgerEntry {
  return {
    id,
    walletId: "wallet-balance-test",
    transactionGroupId: `transaction-${id}`,
    entryType: "administrative_adjustment",
    direction,
    tokenAmount,
    actorAccountId: "account-admin-test",
    relatedCustomerId: "customer-balance-test",
    relatedVendorId: null,
    relatedOrderId: null,
    relatedEvidenceId: null,
    reference: `ADJ-${id}`,
    description: "Wallet balance calculation test entry.",
    occurredAt: "2026-07-27T00:00:00.000Z",
    idempotencyKey: `balance:test:${id}`,
    metadata: { source: "unit_test" },
    reversesLedgerEntryId: null,
  };
}

describe("calculateWalletBalance", () => {
  it("returns zero for an empty ledger", () => {
    expect(calculateWalletBalance([])).toBe(0);
  });

  it("sums immutable credits and debits without storing a balance", () => {
    expect(
      calculateWalletBalance([
        createEntry("credit-1", "credit", 120),
        createEntry("debit-1", "debit", 35),
        createEntry("credit-2", "credit", 5),
      ]),
    ).toBe(90);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects an invalid token amount of %s",
    (tokenAmount) => {
      expect(() =>
        calculateWalletBalance([createEntry("invalid", "credit", tokenAmount)]),
      ).toThrow(InvalidTokenAmountError);
    },
  );

  it("rejects balances outside the safe integer range", () => {
    expect(() =>
      calculateWalletBalance([
        createEntry("maximum", "credit", Number.MAX_SAFE_INTEGER),
        createEntry("overflow", "credit", 1),
      ]),
    ).toThrow(WalletBalanceOverflowError);
  });

  it("is independent of entry order when tied timestamps have a safe exact net", () => {
    const maximumCredit = createEntry(
      "maximum-credit",
      "credit",
      Number.MAX_SAFE_INTEGER,
    );
    const extraCredit = createEntry("extra-credit", "credit", 1);
    const matchingDebit = createEntry("matching-debit", "debit", 1);
    const permutations = [
      [maximumCredit, extraCredit, matchingDebit],
      [extraCredit, matchingDebit, maximumCredit],
      [matchingDebit, maximumCredit, extraCredit],
    ];

    for (const entries of permutations) {
      expect(calculateWalletBalance(entries)).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  it("returns a signed result so mutation services can reject overdrafts", () => {
    expect(calculateWalletBalance([createEntry("debit", "debit", 1)])).toBe(-1);
  });
});
