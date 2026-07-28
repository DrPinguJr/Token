import type { CustomerTransactionListItem } from "@/modules/customer-application";

export interface AdminTokenerAccessSummary {
  readonly customerId: string;
  readonly displayName: string;
  readonly balance: number;
  readonly claimCode: string;
  readonly claimPath: string;
  readonly claimExpiresAt: string;
  readonly claimedAt: string | null;
  readonly privateAccountPath: string;
  readonly walletPublicCode: string;
  readonly walletQrUpdatedAt: string;
}

export interface PrivateAccountReadModel {
  readonly customerId: string;
  readonly displayName: string;
  readonly balance: number;
  readonly walletStatus: "active" | "frozen";
  readonly privateAccountPath: string;
  readonly walletPublicCode: string;
  readonly walletQrPayload: string;
  readonly walletQrUpdatedAt: string;
  readonly transactions: readonly CustomerTransactionListItem[];
}

export interface ClaimedPrivateAccountReadModel {
  readonly displayName: string;
  readonly privateAccountPath: string;
}
