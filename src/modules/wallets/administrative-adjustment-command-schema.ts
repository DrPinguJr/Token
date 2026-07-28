import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
} from "@/shared/validation";
import {
  ledgerDirectionSchema,
  walletOperationIdempotencyKeySchema,
} from "@/modules/transactions";

export const administrativeAdjustmentCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    walletId: domainIdSchema,
    direction: ledgerDirectionSchema,
    tokenAmount: positiveSafeIntegerSchema,
    reason: nonBlankTextSchema.max(400),
    idempotencyKey: walletOperationIdempotencyKeySchema,
  })
  .strict();
