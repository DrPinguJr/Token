import { z } from "zod";

import { ledgerEntrySchema, type LedgerEntry } from "@/modules/transactions";
import { domainIdSchema, utcTimestampSchema } from "@/shared/validation";

const vendorEarningsCalculationSchema = z
  .object({
    vendorId: domainIdSchema,
    vendorWalletId: domainIdSchema,
    periodStart: utcTimestampSchema,
    periodEnd: utcTimestampSchema,
    ledgerEntries: z.array(ledgerEntrySchema),
  })
  .strict()
  .superRefine(({ periodStart, periodEnd }, context) => {
    if (Date.parse(periodEnd) <= Date.parse(periodStart)) {
      context.addIssue({
        code: "custom",
        message: "Settlement period end must be after its start.",
        path: ["periodEnd"],
      });
    }
  });

export interface VendorEarningsCalculation {
  readonly vendorId: string;
  readonly vendorWalletId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly ledgerEntries: readonly LedgerEntry[];
}

export type VendorSettlementCalculationErrorCode =
  | "SETTLEMENT_CALCULATION_INVALID_INPUT"
  | "SETTLEMENT_CALCULATION_INVALID_REFUND_REVERSAL"
  | "SETTLEMENT_CALCULATION_UNSAFE_TOTAL";

const vendorSettlementCalculationErrorMessages = {
  SETTLEMENT_CALCULATION_INVALID_INPUT:
    "The vendor settlement calculation input is invalid.",
  SETTLEMENT_CALCULATION_INVALID_REFUND_REVERSAL:
    "A vendor refund does not validly reverse an original receipt in the same wallet and order.",
  SETTLEMENT_CALCULATION_UNSAFE_TOTAL:
    "The vendor settlement total exceeds the supported safe-integer range.",
} as const satisfies Record<VendorSettlementCalculationErrorCode, string>;

export class VendorSettlementCalculationError extends Error {
  public constructor(
    public readonly code: VendorSettlementCalculationErrorCode,
  ) {
    super(vendorSettlementCalculationErrorMessages[code]);
    this.name = "VendorSettlementCalculationError";
  }
}

/**
 * Calculates vendor earnings from authoritative wallet ledger activity.
 *
 * The accounting window is half-open: `periodStart` is inclusive and
 * `periodEnd` is exclusive. Adjacent periods can therefore share a boundary
 * timestamp without counting a receipt or refund twice.
 *
 * Only vendor receipt credits and vendor refund debits for the exact
 * `vendorId`/`vendorWalletId` pair contribute. `ledgerEntries` must be the full
 * authoritative ledger set needed to resolve a refund to its original receipt,
 * even when that receipt falls outside the accounting window. The signed
 * result is receipts minus refunds; callers creating a settlement record must
 * separately enforce that its snapshot is non-negative.
 */
export function calculateVendorEarnedTokens(
  input: VendorEarningsCalculation,
): number {
  const parsedInput = vendorEarningsCalculationSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new VendorSettlementCalculationError(
      "SETTLEMENT_CALCULATION_INVALID_INPUT",
    );
  }

  const periodStart = Date.parse(parsedInput.data.periodStart);
  const periodEnd = Date.parse(parsedInput.data.periodEnd);
  const entriesById = new Map<string, LedgerEntry>();

  for (const entry of parsedInput.data.ledgerEntries) {
    if (entriesById.has(entry.id)) {
      throw new VendorSettlementCalculationError(
        "SETTLEMENT_CALCULATION_INVALID_INPUT",
      );
    }

    entriesById.set(entry.id, entry);
  }

  const reversedTokenAmounts = new Map<string, bigint>();

  for (const entry of parsedInput.data.ledgerEntries) {
    if (
      entry.entryType !== "vendor_refund" ||
      entry.relatedVendorId !== parsedInput.data.vendorId ||
      entry.walletId !== parsedInput.data.vendorWalletId
    ) {
      continue;
    }

    const originalEntry =
      entry.reversesLedgerEntryId === null
        ? undefined
        : entriesById.get(entry.reversesLedgerEntryId);

    if (
      originalEntry === undefined ||
      originalEntry.id === entry.id ||
      originalEntry.entryType !== "vendor_receipt" ||
      originalEntry.direction !== "credit" ||
      originalEntry.walletId !== parsedInput.data.vendorWalletId ||
      originalEntry.relatedVendorId !== parsedInput.data.vendorId ||
      originalEntry.relatedOrderId !== entry.relatedOrderId ||
      originalEntry.relatedCustomerId !== entry.relatedCustomerId ||
      originalEntry.reversesLedgerEntryId !== null
    ) {
      throw new VendorSettlementCalculationError(
        "SETTLEMENT_CALCULATION_INVALID_REFUND_REVERSAL",
      );
    }

    const reversedTokenAmount =
      (reversedTokenAmounts.get(originalEntry.id) ?? BigInt(0)) +
      BigInt(entry.tokenAmount);

    if (reversedTokenAmount > BigInt(originalEntry.tokenAmount)) {
      throw new VendorSettlementCalculationError(
        "SETTLEMENT_CALCULATION_INVALID_REFUND_REVERSAL",
      );
    }

    reversedTokenAmounts.set(originalEntry.id, reversedTokenAmount);
  }

  let earnedTokenAmount = BigInt(0);

  for (const entry of parsedInput.data.ledgerEntries) {
    const occurredAt = Date.parse(entry.occurredAt);
    const isInPeriod = occurredAt >= periodStart && occurredAt < periodEnd;

    if (
      !isInPeriod ||
      entry.relatedVendorId !== parsedInput.data.vendorId ||
      entry.walletId !== parsedInput.data.vendorWalletId
    ) {
      continue;
    }

    if (entry.entryType === "vendor_receipt" && entry.direction === "credit") {
      earnedTokenAmount += BigInt(entry.tokenAmount);
    } else if (
      entry.entryType === "vendor_refund" &&
      entry.direction === "debit"
    ) {
      earnedTokenAmount -= BigInt(entry.tokenAmount);
    } else {
      continue;
    }
  }

  const maximumSafeTotal = BigInt(Number.MAX_SAFE_INTEGER);

  if (
    earnedTokenAmount > maximumSafeTotal ||
    earnedTokenAmount < -maximumSafeTotal
  ) {
    throw new VendorSettlementCalculationError(
      "SETTLEMENT_CALCULATION_UNSAFE_TOTAL",
    );
  }

  return Number(earnedTokenAmount);
}
