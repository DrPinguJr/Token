import { z } from "zod";

import { domainIdSchema } from "@/shared/validation";

export const walletPinSchema = z.string().regex(/^[0-9]{4}$/);

export const pinVerificationCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    pin: walletPinSchema,
  })
  .strict();

export const pinSetupCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    pin: walletPinSchema,
  })
  .strict();

export const pinChangeCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    currentPin: walletPinSchema,
    newPin: walletPinSchema,
  })
  .strict();

export type PinVerificationCommand = Readonly<
  z.infer<typeof pinVerificationCommandSchema>
>;
export type PinSetupCommand = Readonly<z.infer<typeof pinSetupCommandSchema>>;
export type PinChangeCommand = Readonly<z.infer<typeof pinChangeCommandSchema>>;
