import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(1, "Enter your username.")
  .max(64, "Enter a valid username.")
  .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, "Enter a valid username.");

const passwordSchema = z
  .string()
  .min(1, "Enter your password.")
  .max(128, "Enter a valid password.");

export const accountEntrySchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();

export type AccountEntryFormInput = z.input<typeof accountEntrySchema>;
export type AccountEntryInput = z.output<typeof accountEntrySchema>;
