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

export function assertPositiveTokenAmount(tokenAmount: number): void {
  if (!Number.isSafeInteger(tokenAmount) || tokenAmount <= 0) {
    throw new InvalidTokenAmountError(tokenAmount);
  }
}

export function assertTransactionActor(actorAccountId: string): void {
  if (actorAccountId.trim().length === 0) {
    throw new TransactionActorRequiredError();
  }
}

export async function assertIdempotencyKeyAvailable(
  repository: Pick<LedgerEntryRepository, "getByIdempotencyKey">,
  idempotencyKey: string,
): Promise<void> {
  const existingEntry = await repository.getByIdempotencyKey(idempotencyKey);

  if (existingEntry !== null) {
    throw new DuplicateIdempotencyKeyError(idempotencyKey);
  }
}

export async function assertTransactionGroupIdAvailable(
  repository: Pick<LedgerEntryRepository, "findByTransactionGroupId">,
  transactionGroupId: string,
): Promise<void> {
  const existingEntries =
    await repository.findByTransactionGroupId(transactionGroupId);

  if (existingEntries.length > 0) {
    throw new DuplicateTransactionGroupIdError(transactionGroupId);
  }
}

export function assertNonNegativeWalletBalance(balance: number): void {
  if (!Number.isSafeInteger(balance)) {
    throw new WalletBalanceOverflowError();
  }

  if (balance < 0) {
    throw new NegativeWalletBalanceError(balance);
  }
}

export function calculateProjectedWalletBalance(
  currentBalance: number,
  direction: "credit" | "debit",
  tokenAmount: number,
): number {
  assertNonNegativeWalletBalance(currentBalance);
  assertPositiveTokenAmount(tokenAmount);

  if (direction === "debit" && tokenAmount > currentBalance) {
    throw new InsufficientWalletBalanceError(currentBalance, tokenAmount);
  }

  const projectedBalance =
    direction === "credit"
      ? currentBalance + tokenAmount
      : currentBalance - tokenAmount;

  if (!Number.isSafeInteger(projectedBalance)) {
    throw new WalletBalanceOverflowError();
  }

  return projectedBalance;
}

export function assertWalletCanDebit(
  availableTokenAmount: number,
  requestedTokenAmount: number,
): void {
  calculateProjectedWalletBalance(
    availableTokenAmount,
    "debit",
    requestedTokenAmount,
  );
}
