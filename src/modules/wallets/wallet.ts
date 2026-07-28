import type { z } from "zod";

import type {
  walletOwnerTypeSchema,
  walletQuerySchema,
  walletSchema,
  walletStatusSchema,
} from "./wallet-schema";

export type WalletId = string;
export type WalletOwnerType = z.infer<typeof walletOwnerTypeSchema>;
export type WalletStatus = z.infer<typeof walletStatusSchema>;
export type Wallet = Readonly<z.infer<typeof walletSchema>>;
export type WalletQuery = Readonly<z.infer<typeof walletQuerySchema>>;
