import { describe, expect, it } from "vitest";

import type { LedgerEntryRepository } from "./ledger-entry-repository";
import {
  DuplicateIdempotencyKeyError,
  DuplicateTransactionGroupIdError,
  InsufficientWalletBalanceError,
  InvalidTokenAmountError,
  NegativeWalletBalanceError,
  TransactionActorRequiredError,
  WalletBalanceOverflowError,
} from "./wallet-transaction-errors";
import {
  assertIdempotencyKeyAvailable,
  assertNonNegativeWalletBalance,
  assertPositiveTokenAmount,
  assertTransactionGroupIdAvailable,
  assertTransactionActor,
  assertWalletCanDebit,
  calculateProjectedWalletBalance,
} from "./wallet-transaction-invariants";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  walletOperationIdempotencyKeySchema,
} from "./wallet-operation-idempotency";

describe("wallet transaction invariants", () => {
  it("accepts only positive safe integer token amounts", () => {
    expect(() => assertPositiveTokenAmount(1)).not.toThrow();
    expect(() => assertPositiveTokenAmount(0)).toThrow(InvalidTokenAmountError);
    expect(() => assertPositiveTokenAmount(1.25)).toThrow(
      InvalidTokenAmountError,
    );
  });

  it("requires an actor", () => {
    expect(() => assertTransactionActor("account-staff-001")).not.toThrow();
    expect(() => assertTransactionActor("   ")).toThrow(
      TransactionActorRequiredError,
    );
  });

  it("rejects a duplicate event-level ledger idempotency key", async () => {
    const repository = {
      getByIdempotencyKey: async () => ({
        id: "existing-ledger-entry",
      }),
    } as unknown as Pick<LedgerEntryRepository, "getByIdempotencyKey">;

    await expect(
      assertIdempotencyKeyAvailable(repository, "operation:key:001"),
    ).rejects.toBeInstanceOf(DuplicateIdempotencyKeyError);
  });

  it("rejects a transaction-group identifier already represented in the ledger", async () => {
    const repository = {
      findByTransactionGroupId: async () => [
        {
          id: "existing-ledger-entry",
        },
      ],
    } as unknown as Pick<LedgerEntryRepository, "findByTransactionGroupId">;

    await expect(
      assertTransactionGroupIdAvailable(repository, "transaction-existing"),
    ).rejects.toBeInstanceOf(DuplicateTransactionGroupIdError);
  });

  it("prevents negative balances and overdrawing debits", () => {
    expect(() => assertNonNegativeWalletBalance(-1)).toThrow(
      NegativeWalletBalanceError,
    );
    expect(() => assertWalletCanDebit(10, 11)).toThrow(
      InsufficientWalletBalanceError,
    );
    expect(() => assertWalletCanDebit(10, 10)).not.toThrow();
  });

  it("rejects an overflowing projected credit", () => {
    expect(() =>
      calculateProjectedWalletBalance(Number.MAX_SAFE_INTEGER, "credit", 1),
    ).toThrow(WalletBalanceOverflowError);
  });

  it("creates prefix-free reservation and scoped entry keys", () => {
    const operationKey = walletOperationIdempotencyKeySchema.parse(
      "operation:purchase:001",
    );

    expect(createOperationLedgerIdempotencyKey(operationKey)).toBe(
      "operation:22:operation:purchase:001",
    );
    expect(
      createScopedLedgerIdempotencyKey(operationKey, "vendor-credit"),
    ).toBe("entry:vendor-credit:22:operation:purchase:001");
    expect(
      createScopedLedgerIdempotencyKey(
        `${operationKey}:vendor-credit`,
        "vendor-credit",
      ),
    ).not.toBe(createScopedLedgerIdempotencyKey(operationKey, "vendor-credit"));
    expect(createOperationLedgerIdempotencyKey(operationKey)).not.toBe(
      createScopedLedgerIdempotencyKey(operationKey, "issuance-credit"),
    );
  });

  it("keeps maximum-length operation and entry keys within persistence limits", () => {
    const operationKey = "x".repeat(128);

    expect(
      createOperationLedgerIdempotencyKey(operationKey).length,
    ).toBeLessThanOrEqual(160);
    expect(
      createScopedLedgerIdempotencyKey(operationKey, "adjustment-entry").length,
    ).toBeLessThanOrEqual(160);
  });
});
