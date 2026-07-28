import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  nonNegativeSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const settlementStatusSchema = z.enum(["draft", "approved", "paid"]);

export const settlementSchema = z
  .object({
    id: domainIdSchema,
    reference: nonBlankTextSchema.max(120),
    vendorId: domainIdSchema,
    periodStart: utcTimestampSchema,
    periodEnd: utcTimestampSchema,
    earnedTokenAmount: nonNegativeSafeIntegerSchema,
    status: settlementStatusSchema,
    payoutReference: nonBlankTextSchema.max(120).nullable(),
    notes: nonBlankTextSchema.max(1_000).nullable(),
    createdByAccountId: domainIdSchema,
    approvedByAccountId: domainIdSchema.nullable(),
    paidByAccountId: domainIdSchema.nullable(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict()
  .superRefine((settlement, context) => {
    if (
      Date.parse(settlement.periodEnd) <= Date.parse(settlement.periodStart)
    ) {
      context.addIssue({
        code: "custom",
        message: "Settlement period end must be after its start.",
        path: ["periodEnd"],
      });
    }

    if (
      settlement.status === "draft" &&
      (settlement.approvedByAccountId !== null ||
        settlement.paidByAccountId !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Draft settlements cannot have approval or payment actors.",
        path: ["status"],
      });
    }

    if (
      settlement.status === "approved" &&
      (settlement.approvedByAccountId === null ||
        settlement.paidByAccountId !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Approved settlements require an approval actor and no payment actor.",
        path: ["status"],
      });
    }

    if (
      settlement.status === "paid" &&
      (settlement.approvedByAccountId === null ||
        settlement.paidByAccountId === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Paid settlements require approval and payment actors.",
        path: ["status"],
      });
    }
  });

export const settlementQuerySchema = z
  .object({
    vendorId: domainIdSchema.optional(),
    status: settlementStatusSchema.optional(),
    periodStartFrom: utcTimestampSchema.optional(),
    periodEndTo: utcTimestampSchema.optional(),
  })
  .strict();
