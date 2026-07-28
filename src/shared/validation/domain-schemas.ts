import { z } from "zod";

import type { JsonObject, JsonValue } from "@/shared/types";

const opaqueValuePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const publicCodePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const domainIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(opaqueValuePattern);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .regex(opaqueValuePattern);

export const publicCodeSchema = z
  .string()
  .trim()
  .min(6)
  .max(128)
  .regex(publicCodePattern);

export const nonBlankTextSchema = z.string().trim().min(1);

export const positiveSafeIntegerSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

export const nonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const utcTimestampSchema = z.string().datetime({ offset: false });

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);
