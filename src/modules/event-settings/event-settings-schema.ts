import { z } from "zod";

import {
  domainIdSchema,
  nonBlankTextSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const eventDateRangeSchema = z
  .object({
    startsAt: utcTimestampSchema,
    endsAt: utcTimestampSchema,
  })
  .strict()
  .superRefine((range, context) => {
    if (Date.parse(range.endsAt) <= Date.parse(range.startsAt)) {
      context.addIssue({
        code: "custom",
        message: "Event end must be after its start.",
        path: ["endsAt"],
      });
    }
  });

export const eventSettingsSchema = z
  .object({
    id: domainIdSchema,
    eventName: nonBlankTextSchema.max(160),
    eventSubtitle: z.string().trim().max(240),
    eventDates: eventDateRangeSchema,
    venue: nonBlankTextSchema.max(240),
    tokensPerDollar: positiveSafeIntegerSchema,
    supportLabel: nonBlankTextSchema.max(120),
    supportContact: nonBlankTextSchema.max(240),
    supportInstructions: nonBlankTextSchema.max(2_000),
    updatedByAccountId: domainIdSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();
