import type { CustomerTransactionListItem } from "@/modules/customer-application";

export interface AdminTokenerTransactionItem {
  readonly description: string;
  readonly direction: "credit" | "debit";
  readonly entryType:
    | "administrative_adjustment"
    | "customer_purchase"
    | "customer_refund"
    | "token_issuance"
    | "vendor_receipt"
    | "vendor_refund"
    | "vendor_settlement";
  readonly id: string;
  readonly occurredAt: string;
  readonly reference: string;
  readonly refundableTokenAmount: number;
  readonly title: string;
  readonly tokenAmount: number;
  readonly transactionGroupId: string;
  readonly vendorName: string | null;
  readonly vendorUsername: string | null;
}

export interface AdminTokenerAccessSummary {
  readonly customerId: string;
  readonly displayName: string;
  readonly mobileNumber: string | null;
  readonly balance: number;
  readonly claimPath: string;
  readonly claimExpiresAt: string;
  readonly claimedAt: string | null;
  readonly transactions: readonly AdminTokenerTransactionItem[];
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
