import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  nonNegativeSafeIntegerSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const productSchema = z
  .object({
    id: domainIdSchema,
    vendorId: domainIdSchema,
    name: nonBlankTextSchema.max(160),
    description: z.string().trim().max(1_000),
    image: z.string().trim().min(1).max(500).nullable(),
    tokenPrice: positiveSafeIntegerSchema,
    category: nonBlankTextSchema.max(100),
    isAvailable: z.boolean(),
    isSoldOut: z.boolean(),
    isArchived: z.boolean(),
    displayOrder: nonNegativeSafeIntegerSchema,
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export const productQuerySchema = z
  .object({
    vendorId: domainIdSchema.optional(),
    category: z.string().trim().min(1).max(100).optional(),
    isAvailable: z.boolean().optional(),
    isSoldOut: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();
