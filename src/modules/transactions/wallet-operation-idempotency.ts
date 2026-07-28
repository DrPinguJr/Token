import { z } from "zod";

import { idempotencyKeySchema } from "@/shared/validation";

/**
 * Leaves enough space under the persisted 160-character key limit for the
 * scope appended to a paired ledger entry.
 */
export const walletOperationIdempotencyKeySchema =
  idempotencyKeySchema.max(128);

export const ledgerIdempotencyScopeSchema = z.enum([
  "adjustment-entry",
  "customer-credit",
  "customer-debit",
  "issuance-credit",
  "vendor-credit",
  "vendor-debit",
]);

export type LedgerIdempotencyScope = z.infer<
  typeof ledgerIdempotencyScopeSchema
>;

export function createOperationLedgerIdempotencyKey(
  operationIdempotencyKey: string,
): string {
  const parsedOperationKey = walletOperationIdempotencyKeySchema.parse(
    operationIdempotencyKey,
  );

  return idempotencyKeySchema.parse(
    `operation:${parsedOperationKey.length}:${parsedOperationKey}`,
  );
}

export function createScopedLedgerIdempotencyKey(
  operationIdempotencyKey: string,
  scope: LedgerIdempotencyScope,
): string {
  const parsedOperationKey = walletOperationIdempotencyKeySchema.parse(
    operationIdempotencyKey,
  );
  const parsedScope = ledgerIdempotencyScopeSchema.parse(scope);

  return idempotencyKeySchema.parse(
    `entry:${parsedScope}:${parsedOperationKey.length}:${parsedOperationKey}`,
  );
}
