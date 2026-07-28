import { z } from "zod";

import { domainIdSchema } from "@/shared/validation";

export const customerTransactionRouteInputSchema = z
  .object({
    transactionId: domainIdSchema,
    receipt: z.unknown().transform((value) => value === "1"),
  })
  .strict();

export type CustomerTransactionRouteInput = Readonly<
  z.infer<typeof customerTransactionRouteInputSchema>
>;
