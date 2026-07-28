import type { z } from "zod";

import type {
  accountPinCredentialSchema,
  accountQuerySchema,
  accountRoleSchema,
  accountSchema,
  accountStatusSchema,
} from "./account-schema";

export type AccountId = string;
export type AccountRole = z.infer<typeof accountRoleSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AccountSummary = Readonly<z.infer<typeof accountSchema>>;
export type Account = AccountSummary;
export type AccountPinCredential = Readonly<
  z.infer<typeof accountPinCredentialSchema>
>;
export type AccountQuery = Readonly<z.infer<typeof accountQuerySchema>>;
