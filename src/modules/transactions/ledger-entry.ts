import type { z } from "zod";

import type {
  ledgerDirectionSchema,
  ledgerEntryQuerySchema,
  ledgerEntrySchema,
  ledgerEntryTypeSchema,
} from "./ledger-entry-schema";

export type LedgerEntryId = string;
export type TransactionGroupId = string;
export type LedgerDirection = z.infer<typeof ledgerDirectionSchema>;
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;
export type LedgerEntry = Readonly<z.infer<typeof ledgerEntrySchema>>;
export type LedgerEntryQuery = Readonly<z.infer<typeof ledgerEntryQuerySchema>>;
