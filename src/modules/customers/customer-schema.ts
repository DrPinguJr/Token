import { z } from "zod";

import {
  domainIdSchema,
  publicCodeSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const customerSchema = z
  .object({
    id: domainIdSchema,
    accountId: domainIdSchema,
    walletId: domainIdSchema,
    publicCode: publicCodeSchema,
    onboardingCompletedAt: utcTimestampSchema.nullable(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export const customerQuerySchema = z
  .object({
    onboardingCompleted: z.boolean().optional(),
  })
  .strict();
