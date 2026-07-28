import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  publicCodeSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const vendorOperatingStatusSchema = z.enum(["open", "closed", "paused"]);

const assetReferenceSchema = z.string().trim().min(1).max(500).nullable();

export const vendorSchema = z
  .object({
    id: domainIdSchema,
    accountId: domainIdSchema,
    walletId: domainIdSchema,
    publicCode: publicCodeSchema,
    displayName: nonBlankTextSchema.max(120),
    logo: assetReferenceSchema,
    banner: assetReferenceSchema,
    description: z.string().trim().max(1_000),
    stallLocation: nonBlankTextSchema.max(160),
    operatingStatus: vendorOperatingStatusSchema,
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export const vendorQuerySchema = z
  .object({
    operatingStatus: vendorOperatingStatusSchema.optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
