import { z } from "zod";

import {
  domainIdSchema,
  idempotencyKeySchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const refundSchema = z
  .object({
    id: domainIdSchema,
    reference: nonBlankTextSchema.max(120),
    orderId: domainIdSchema,
    customerId: domainIdSchema,
    vendorId: domainIdSchema,
    tokenAmount: positiveSafeIntegerSchema,
    reason: nonBlankTextSchema.max(500),
    actorAccountId: domainIdSchema,
    transactionGroupId: domainIdSchema,
    idempotencyKey: idempotencyKeySchema,
    createdAt: utcTimestampSchema,
  })
  .strict();

export const refundQuerySchema = z
  .object({
    orderId: domainIdSchema.optional(),
    customerId: domainIdSchema.optional(),
    vendorId: domainIdSchema.optional(),
    actorAccountId: domainIdSchema.optional(),
    fromCreatedAt: utcTimestampSchema.optional(),
    toCreatedAt: utcTimestampSchema.optional(),
  })
  .strict();
