import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  nonNegativeSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const accountRoleSchema = z.enum([
  "customer",
  "vendor",
  "staff",
  "administrator",
]);

export const accountStatusSchema = z.enum(["active", "disabled"]);

export const normalizedMobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{8,15}$/);

export const accountSchema = z
  .object({
    id: domainIdSchema,
    mobileNumber: normalizedMobileNumberSchema,
    displayName: nonBlankTextSchema.max(100),
    role: accountRoleSchema,
    status: accountStatusSchema,
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export const accountPinCredentialSchema = z
  .object({
    accountId: domainIdSchema,
    pinCredential: z.string().min(1).max(512).nullable(),
    failedPinAttempts: nonNegativeSafeIntegerSchema,
    lockedUntil: utcTimestampSchema.nullable(),
  })
  .strict()
  .superRefine((credential, context) => {
    if (
      credential.pinCredential === null &&
      (credential.failedPinAttempts !== 0 || credential.lockedUntil !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "An unconfigured PIN cannot have lockout state.",
        path: ["pinCredential"],
      });
    }
  });

export const accountQuerySchema = z
  .object({
    role: accountRoleSchema.optional(),
    status: accountStatusSchema.optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
