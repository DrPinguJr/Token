export type AdminLedgerDirection = "credit" | "debit";

export interface AdminTransactionMetrics {
  readonly issuedTokens: number;
  readonly refundedTokens: number;
  readonly spentTokens: number;
  readonly transactionGroups: number;
}

export interface AdminTransactionListItem {
  readonly description: string;
  readonly direction: AdminLedgerDirection;
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
  readonly tokenAmount: number;
  readonly transactionGroupId: string;
}

export interface AdminTransactionOverview {
  readonly metrics: AdminTransactionMetrics;
  readonly transactions: readonly AdminTransactionListItem[];
}
