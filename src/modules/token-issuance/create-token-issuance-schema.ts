import { z } from "zod";

import {
  evidenceMetadataSchema,
  evidenceMimeTypeSchema,
  maximumEvidenceSizeBytes,
} from "@/modules/evidence";
import { walletOperationIdempotencyKeySchema } from "@/modules/transactions";
import {
  domainIdSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
} from "@/shared/validation";

import { paymentReferenceSchema } from "./token-issuance-schema";

function isBlob(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object Blob]" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string" &&
    "slice" in value &&
    typeof value.slice === "function"
  );
}

export const tokenIssuanceEvidenceInputSchema = z
  .object({
    fileName: nonBlankTextSchema.max(255),
    mimeType: evidenceMimeTypeSchema,
    sizeBytes: positiveSafeIntegerSchema.max(maximumEvidenceSizeBytes),
    content: z.custom<Blob>(isBlob, "Evidence content must be a Blob."),
    metadata: evidenceMetadataSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.content.size !== evidence.sizeBytes ||
      evidence.content.type !== evidence.mimeType
    ) {
      context.addIssue({
        code: "custom",
        message: "Evidence content must match its declared size and MIME type.",
        path: ["content"],
      });
    }

    if (
      evidence.metadata.source === "deterministic_seed" ||
      evidence.metadata.captureMode === "generated_placeholder"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Staff issuance evidence must be staff-provided or an explicitly labelled development simulation.",
        path: ["metadata", "source"],
      });
    }

    if (
      evidence.metadata.source === "staff_provided" &&
      evidence.metadata.prototypePlaceholder === true
    ) {
      context.addIssue({
        code: "custom",
        message: "Staff-provided evidence cannot be labelled as a placeholder.",
        path: ["metadata", "prototypePlaceholder"],
      });
    }
  });

export const createTokenIssuanceCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    customerId: domainIdSchema,
    paynowAmountCents: positiveSafeIntegerSchema,
    evidence: tokenIssuanceEvidenceInputSchema,
    paymentReference: paymentReferenceSchema.nullable().optional(),
    note: nonBlankTextSchema.max(500).nullable().optional(),
    duplicatePaymentReferenceAcknowledged: z
      .boolean()
      .optional()
      .default(false),
    idempotencyKey: walletOperationIdempotencyKeySchema,
  })
  .strict();

export type TokenIssuanceEvidenceInput = Readonly<
  z.infer<typeof tokenIssuanceEvidenceInputSchema>
>;
export type CreateTokenIssuanceCommand = Readonly<
  z.infer<typeof createTokenIssuanceCommandSchema>
>;
