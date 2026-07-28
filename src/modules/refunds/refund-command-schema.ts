import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
} from "@/shared/validation";
import { walletOperationIdempotencyKeySchema } from "@/modules/transactions";

export const refundCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    orderId: domainIdSchema,
    tokenAmount: positiveSafeIntegerSchema,
    reason: nonBlankTextSchema.max(400),
    idempotencyKey: walletOperationIdempotencyKeySchema,
  })
  .strict();
