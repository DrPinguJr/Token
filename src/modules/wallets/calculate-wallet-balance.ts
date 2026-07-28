import type { LedgerEntry } from "@/modules/transactions";
import {
  InvalidTokenAmountError,
  WalletBalanceOverflowError,
} from "@/modules/transactions";

const maximumSafeBalance = BigInt(Number.MAX_SAFE_INTEGER);
const minimumSafeBalance = -maximumSafeBalance;

/**
 * Calculates the signed balance represented by immutable ledger entries.
 * Mutation services separately reject a projected negative balance.
 */
export function calculateWalletBalance(
  entries: readonly LedgerEntry[],
): number {
  let balance = BigInt(0);

  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.tokenAmount) || entry.tokenAmount <= 0) {
      throw new InvalidTokenAmountError(entry.tokenAmount);
    }

    const tokenAmount = BigInt(entry.tokenAmount);
    balance += entry.direction === "credit" ? tokenAmount : -tokenAmount;
  }

  if (balance > maximumSafeBalance || balance < minimumSafeBalance) {
    throw new WalletBalanceOverflowError();
  }

  return Number(balance);
}
