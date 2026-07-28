export type CustomerTransactionKind =
  "adjustment" | "issuance" | "other" | "purchase" | "refund";

export interface CustomerEventReadModel {
  readonly name: string;
  readonly subtitle: string;
  readonly venue: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface CustomerIdentityReadModel {
  readonly accountId: string;
  readonly customerId: string;
  readonly displayName: string;
}

export interface CustomerWalletReadModel {
  readonly id: string;
  readonly balance: number;
  readonly status: "active" | "frozen";
}

export interface CustomerTransactionListItem {
  readonly id: string;
  readonly transactionId: string;
  readonly transactionGroupId: string;
  readonly kind: CustomerTransactionKind;
  readonly direction: "credit" | "debit";
  readonly tokenAmount: number;
  readonly reference: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly subtitle: string;
  readonly vendorName: string | null;
  readonly orderId: string | null;
}

export interface CustomerHomeReadModel {
  readonly event: CustomerEventReadModel;
  readonly customer: CustomerIdentityReadModel;
  readonly wallet: CustomerWalletReadModel;
  readonly recentTransactions: readonly CustomerTransactionListItem[];
}

export interface CustomerWalletPageReadModel {
  readonly customer: CustomerIdentityReadModel;
  readonly wallet: CustomerWalletReadModel;
  readonly transactions: readonly CustomerTransactionListItem[];
}

export interface CustomerTransactionHistoryReadModel {
  readonly customer: CustomerIdentityReadModel;
  readonly transactions: readonly CustomerTransactionListItem[];
}

export interface CustomerOrderItemReadModel {
  readonly productId: string;
  readonly productName: string;
  readonly unitTokenPrice: number;
  readonly quantity: number;
  readonly lineTokenTotal: number;
}

export interface CustomerOrderReadModel {
  readonly id: string;
  readonly reference: string;
  readonly completedAt: string;
  readonly tokenTotal: number;
  readonly items: readonly CustomerOrderItemReadModel[];
  readonly refundedTokenAmount: number;
}

export interface CustomerRefundReadModel {
  readonly id: string;
  readonly reference: string;
  readonly tokenAmount: number;
  readonly reason: string;
  readonly createdAt: string;
}

export interface CustomerIssuanceReadModel {
  readonly reference: string;
  readonly paynowAmountCents: number;
  readonly tokensPerDollar: number;
  readonly tokenAmount: number;
  readonly paymentReference: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CustomerTransactionDetailReadModel {
  readonly id: string;
  readonly transactionGroupId: string;
  readonly kind: CustomerTransactionKind;
  readonly direction: "credit" | "debit";
  readonly tokenAmount: number;
  readonly reference: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly description: string;
  readonly vendorName: string | null;
  readonly order: CustomerOrderReadModel | null;
  readonly refunds: readonly CustomerRefundReadModel[];
  readonly selectedRefundId: string | null;
  readonly issuance: CustomerIssuanceReadModel | null;
}
