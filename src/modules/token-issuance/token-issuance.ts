import type { z } from "zod";

import type {
  tokenIssuanceQuerySchema,
  tokenIssuanceSchema,
} from "./token-issuance-schema";

export type TokenIssuanceId = string;
export type TokenIssuance = Readonly<z.infer<typeof tokenIssuanceSchema>>;
export type TokenIssuanceQuery = Readonly<
  z.infer<typeof tokenIssuanceQuerySchema>
>;
