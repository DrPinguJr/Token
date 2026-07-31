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

export interface AdminCreditIssuanceReportItem {
  readonly createdAt: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly evidenceFileName: string;
  readonly evidenceMimeType: string;
  readonly evidencePreviewUrl: string | null;
  readonly evidenceStoragePath: string;
  readonly id: string;
  readonly mobileNumber: string | null;
  readonly paymentMethod: "cash" | "paynow" | "unknown";
  readonly reference: string;
  readonly sgdAmountCents: number;
  readonly tokenAmount: number;
  readonly transactionGroupId: string;
}

export type AdminBoothCategory = "food" | "games" | "vendor1";

export interface AdminBoothSummary {
  readonly boothNumber: number;
  readonly creditedTokens: number;
  readonly debitedTokens: number;
  readonly netTokens: number;
  readonly stallLocation: string;
  readonly transactionCount: number;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly vendorUsername: string;
}

export interface AdminBoothTransactionItem {
  readonly boothNumber: number;
  readonly description: string;
  readonly direction: AdminLedgerDirection;
  readonly entryType: AdminTransactionListItem["entryType"];
  readonly id: string;
  readonly occurredAt: string;
  readonly reference: string;
  readonly stallLocation: string;
  readonly tokenAmount: number;
  readonly transactionGroupId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly vendorUsername: string;
}

export interface AdminBoothReport {
  readonly category: AdminBoothCategory;
  readonly summaries: readonly AdminBoothSummary[];
  readonly transactions: readonly AdminBoothTransactionItem[];
}

export interface AdminTransactionOverview {
  readonly boothReports: readonly AdminBoothReport[];
  readonly creditIssuances: readonly AdminCreditIssuanceReportItem[];
  readonly metrics: AdminTransactionMetrics;
  readonly transactions: readonly AdminTransactionListItem[];
}
