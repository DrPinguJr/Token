import { z } from "zod";

import { domainIdSchema, utcTimestampSchema } from "@/shared/validation";

export const walletOwnerTypeSchema = z.enum(["customer", "vendor"]);
export const walletStatusSchema = z.enum(["active", "frozen"]);

export const walletSchema = z
  .object({
    id: domainIdSchema,
    ownerAccountId: domainIdSchema,
    ownerType: walletOwnerTypeSchema,
    status: walletStatusSchema,
    createdAt: utcTimestampSchema,
  })
  .strict();

export const walletQuerySchema = z
  .object({
    ownerType: walletOwnerTypeSchema.optional(),
    status: walletStatusSchema.optional(),
  })
  .strict();
