import type { z } from "zod";

import type {
  settlementQuerySchema,
  settlementSchema,
  settlementStatusSchema,
} from "./settlement-schema";

export type SettlementId = string;
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
export type Settlement = Readonly<z.infer<typeof settlementSchema>>;
export type SettlementQuery = Readonly<z.infer<typeof settlementQuerySchema>>;
