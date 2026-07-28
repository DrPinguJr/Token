import { z } from "zod";

import {
  domainIdSchema,
  idempotencyKeySchema,
  jsonObjectSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const ledgerDirectionSchema = z.enum(["credit", "debit"]);

export const ledgerEntryTypeSchema = z.enum([
  "token_issuance",
  "customer_purchase",
  "vendor_receipt",
  "customer_refund",
  "vendor_refund",
  "vendor_settlement",
  "administrative_adjustment",
]);

type LedgerRelationshipField =
  | "relatedCustomerId"
  | "relatedEvidenceId"
  | "relatedOrderId"
  | "relatedVendorId";

interface LedgerEntrySemanticRule {
  readonly direction: "credit" | "debit" | null;
  readonly requiredRelationships: readonly LedgerRelationshipField[];
  readonly forbiddenRelationships: readonly LedgerRelationshipField[];
  readonly requiresReversal: boolean;
}

const ledgerEntrySemanticRules = {
  token_issuance: {
    direction: "credit",
    requiredRelationships: ["relatedCustomerId", "relatedEvidenceId"],
    forbiddenRelationships: ["relatedOrderId", "relatedVendorId"],
    requiresReversal: false,
  },
  customer_purchase: {
    direction: "debit",
    requiredRelationships: [
      "relatedCustomerId",
      "relatedOrderId",
      "relatedVendorId",
    ],
    forbiddenRelationships: ["relatedEvidenceId"],
    requiresReversal: false,
  },
  vendor_receipt: {
    direction: "credit",
    requiredRelationships: [
      "relatedCustomerId",
      "relatedOrderId",
      "relatedVendorId",
    ],
    forbiddenRelationships: ["relatedEvidenceId"],
    requiresReversal: false,
  },
  customer_refund: {
    direction: "credit",
    requiredRelationships: [
      "relatedCustomerId",
      "relatedOrderId",
      "relatedVendorId",
    ],
    forbiddenRelationships: ["relatedEvidenceId"],
    requiresReversal: true,
  },
  vendor_refund: {
    direction: "debit",
    requiredRelationships: [
      "relatedCustomerId",
      "relatedOrderId",
      "relatedVendorId",
    ],
    forbiddenRelationships: ["relatedEvidenceId"],
    requiresReversal: true,
  },
  vendor_settlement: {
    direction: "debit",
    requiredRelationships: ["relatedVendorId"],
    forbiddenRelationships: [
      "relatedCustomerId",
      "relatedEvidenceId",
      "relatedOrderId",
    ],
    requiresReversal: false,
  },
  administrative_adjustment: {
    direction: null,
    requiredRelationships: [],
    forbiddenRelationships: ["relatedEvidenceId", "relatedOrderId"],
    requiresReversal: false,
  },
} as const satisfies Record<
  z.infer<typeof ledgerEntryTypeSchema>,
  LedgerEntrySemanticRule
>;

export const ledgerEntrySchema = z
  .object({
    id: domainIdSchema,
    walletId: domainIdSchema,
    transactionGroupId: domainIdSchema,
    entryType: ledgerEntryTypeSchema,
    direction: ledgerDirectionSchema,
    tokenAmount: positiveSafeIntegerSchema,
    actorAccountId: domainIdSchema,
    relatedCustomerId: domainIdSchema.nullable(),
    relatedVendorId: domainIdSchema.nullable(),
    relatedOrderId: domainIdSchema.nullable(),
    relatedEvidenceId: domainIdSchema.nullable(),
    reference: nonBlankTextSchema.max(120),
    description: nonBlankTextSchema.max(500),
    occurredAt: utcTimestampSchema,
    idempotencyKey: idempotencyKeySchema,
    metadata: jsonObjectSchema,
    reversesLedgerEntryId: domainIdSchema.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    const rule = ledgerEntrySemanticRules[entry.entryType];

    if (rule.direction !== null && entry.direction !== rule.direction) {
      context.addIssue({
        code: "custom",
        message: `${entry.entryType} entries must use the ${rule.direction} direction.`,
        path: ["direction"],
      });
    }

    for (const relationship of rule.requiredRelationships) {
      if (entry[relationship] === null) {
        context.addIssue({
          code: "custom",
          message: `${entry.entryType} entries require ${relationship}.`,
          path: [relationship],
        });
      }
    }

    for (const relationship of rule.forbiddenRelationships) {
      if (entry[relationship] !== null) {
        context.addIssue({
          code: "custom",
          message: `${entry.entryType} entries cannot set ${relationship}.`,
          path: [relationship],
        });
      }
    }

    if (rule.requiresReversal === (entry.reversesLedgerEntryId === null)) {
      context.addIssue({
        code: "custom",
        message: rule.requiresReversal
          ? `${entry.entryType} entries must reverse an original ledger entry.`
          : `${entry.entryType} entries cannot reverse another ledger entry.`,
        path: ["reversesLedgerEntryId"],
      });
    }
  });

export const ledgerEntryQuerySchema = z
  .object({
    walletId: domainIdSchema.optional(),
    transactionGroupId: domainIdSchema.optional(),
    entryType: ledgerEntryTypeSchema.optional(),
    direction: ledgerDirectionSchema.optional(),
    actorAccountId: domainIdSchema.optional(),
    relatedCustomerId: domainIdSchema.optional(),
    relatedVendorId: domainIdSchema.optional(),
    relatedOrderId: domainIdSchema.optional(),
    fromOccurredAt: utcTimestampSchema.optional(),
    toOccurredAt: utcTimestampSchema.optional(),
  })
  .strict();
