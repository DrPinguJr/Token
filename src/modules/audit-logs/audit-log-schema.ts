import { z } from "zod";

import {
  domainIdSchema,
  jsonObjectSchema,
  nonBlankTextSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const auditEventTypeSchema = z.enum([
  "account_entry",
  "onboarding_completed",
  "pin_setup",
  "pin_verification_failed",
  "token_issuance_created",
  "evidence_attached",
  "purchase_completed",
  "refund_created",
  "product_created",
  "product_updated",
  "product_availability_changed",
  "vendor_profile_updated",
  "settlement_created",
  "settlement_status_changed",
  "administrative_adjustment_created",
  "event_settings_changed",
  "customer_claim_qr_claimed",
  "customer_wallet_qr_regenerated",
]);

export const auditTargetTypeSchema = z.enum([
  "account",
  "customer",
  "wallet",
  "ledger_entry",
  "token_issuance",
  "evidence",
  "vendor",
  "product",
  "order",
  "refund",
  "settlement",
  "event_settings",
]);

export const auditLogSchema = z
  .object({
    id: domainIdSchema,
    eventType: auditEventTypeSchema,
    actorAccountId: domainIdSchema,
    targetType: auditTargetTypeSchema,
    targetId: domainIdSchema,
    description: nonBlankTextSchema.max(500),
    occurredAt: utcTimestampSchema,
    metadata: jsonObjectSchema,
    transactionGroupId: domainIdSchema.nullable(),
  })
  .strict();

export const auditLogQuerySchema = z
  .object({
    eventType: auditEventTypeSchema.optional(),
    actorAccountId: domainIdSchema.optional(),
    targetType: auditTargetTypeSchema.optional(),
    targetId: domainIdSchema.optional(),
    transactionGroupId: domainIdSchema.optional(),
    fromOccurredAt: utcTimestampSchema.optional(),
    toOccurredAt: utcTimestampSchema.optional(),
  })
  .strict();
