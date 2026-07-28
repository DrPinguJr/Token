import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const maximumEvidenceSizeBytes = 5 * 1024 * 1024;

export const evidenceKindSchema = z.literal("paynow_screenshot");

export const evidenceMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const evidenceSourceSchema = z.enum([
  "deterministic_seed",
  "staff_provided",
  "development_simulator",
]);

export const evidenceCaptureModeSchema = z.enum([
  "file_upload",
  "camera_capture",
  "generated_placeholder",
]);

export const evidenceCameraFacingModeSchema = z.enum([
  "environment",
  "user",
  "unknown",
]);

/**
 * Evidence metadata describes only how local content was sourced or captured.
 * Payment-check outcomes belong to issuance workflow records and audit events,
 * never evidence metadata.
 */
export const evidenceMetadataSchema = z
  .object({
    source: evidenceSourceSchema,
    captureMode: evidenceCaptureModeSchema,
    prototypePlaceholder: z.boolean().optional(),
    originalFileLastModifiedAt: utcTimestampSchema.optional(),
    cameraFacingMode: evidenceCameraFacingModeSchema.optional(),
  })
  .strict();

export const evidenceSchema = z
  .object({
    id: domainIdSchema,
    kind: evidenceKindSchema,
    fileName: nonBlankTextSchema.max(255),
    mimeType: evidenceMimeTypeSchema,
    sizeBytes: positiveSafeIntegerSchema.max(maximumEvidenceSizeBytes),
    localBlobKey: domainIdSchema,
    capturedByAccountId: domainIdSchema,
    createdAt: utcTimestampSchema,
    metadata: evidenceMetadataSchema,
  })
  .strict();

export const evidenceQuerySchema = z
  .object({
    kind: evidenceKindSchema.optional(),
    capturedByAccountId: domainIdSchema.optional(),
    fromCreatedAt: utcTimestampSchema.optional(),
    toCreatedAt: utcTimestampSchema.optional(),
  })
  .strict();
