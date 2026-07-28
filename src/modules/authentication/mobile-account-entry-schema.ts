import { z } from "zod";

import { normalizedMobileNumberSchema } from "@/modules/accounts";

const mobileNumberCharactersSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number.")
  .max(32, "Enter a valid mobile number.")
  .regex(/^\+?[0-9()\s-]+$/, "Enter a valid mobile number.");

/**
 * Normalizes the deliberately small set of formatting characters accepted by
 * the local entry form. Singapore's +65 prefix is removed so formatted input
 * resolves to the same repository key as the eight-digit seeded accounts.
 */
export function normalizeAccountEntryMobileNumber(value: string): string {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+/, "");

  return digits.length === 10 && digits.startsWith("65")
    ? digits.slice(2)
    : digits;
}

const accountEntryMobileNumberSchema = mobileNumberCharactersSchema
  .transform(normalizeAccountEntryMobileNumber)
  .refine(
    (value) => normalizedMobileNumberSchema.safeParse(value).success,
    "Enter 8 to 15 digits.",
  );

export const accountEntrySchema = z
  .object({
    mobileNumber: accountEntryMobileNumberSchema,
  })
  .strict();

export type AccountEntryFormInput = z.input<typeof accountEntrySchema>;
export type AccountEntryInput = z.output<typeof accountEntrySchema>;
