import { z } from "zod";

import {
  domainIdSchema,
  idempotencyKeySchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const paymentReferenceSchema = z.string().trim().min(1).max(80);

export const tokenIssuanceSchema = z
  .object({
    id: domainIdSchema,
    customerId: domainIdSchema,
    walletId: domainIdSchema,
    staffAccountId: domainIdSchema,
    evidenceId: domainIdSchema,
    paynowAmountCents: positiveSafeIntegerSchema,
    tokensPerDollar: positiveSafeIntegerSchema,
    tokenAmount: positiveSafeIntegerSchema,
    paymentReference: paymentReferenceSchema.nullable(),
    normalizedPaymentReference: paymentReferenceSchema.nullable(),
    note: nonBlankTextSchema.max(500).nullable(),
    transactionGroupId: domainIdSchema,
    reference: nonBlankTextSchema.max(120),
    idempotencyKey: idempotencyKeySchema,
    createdAt: utcTimestampSchema,
  })
  .strict()
  .superRefine((issuance, context) => {
    if (
      (issuance.paymentReference === null) !==
      (issuance.normalizedPaymentReference === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Payment reference and normalized payment reference must be provided together.",
        path: ["normalizedPaymentReference"],
      });
    }
  });

export const tokenIssuanceQuerySchema = z
  .object({
    customerId: domainIdSchema.optional(),
    staffAccountId: domainIdSchema.optional(),
    fromCreatedAt: utcTimestampSchema.optional(),
    toCreatedAt: utcTimestampSchema.optional(),
  })
  .strict();
