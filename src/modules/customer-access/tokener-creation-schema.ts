import { z } from "zod";

const singaporeMobileNumberSchema = z
  .string()
  .transform((value) => value.trim().replace(/[\s()-]/g, ""))
  .transform((value) => (value.startsWith("+65") ? value.slice(3) : value))
  .pipe(
    z
      .string()
      .regex(/^[689][0-9]{7}$/, "Enter a valid Singapore mobile number."),
  );

export const createTokenerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    mobileNumber: singaporeMobileNumberSchema,
  })
  .strict();

export type CreateTokenerInput = z.infer<typeof createTokenerSchema>;
