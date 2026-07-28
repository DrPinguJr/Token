export type RefundServiceErrorCode =
  | "REFUND_INVALID_COMMAND"
  | "REFUND_ACTOR_NOT_ACTIVE_VENDOR"
  | "REFUND_VENDOR_NOT_FOUND"
  | "REFUND_ORDER_NOT_FOUND"
  | "REFUND_ORDER_NOT_COMPLETED"
  | "REFUND_ORDER_OWNERSHIP_MISMATCH"
  | "REFUND_ORDER_RELATIONSHIPS_INVALID"
  | "REFUND_CUSTOMER_ACCOUNT_INVALID"
  | "REFUND_WALLET_NOT_ACTIVE"
  | "REFUND_DUPLICATE_IDEMPOTENCY_KEY"
  | "REFUND_TRANSACTION_GROUP_COLLISION"
  | "REFUND_ORIGINAL_LEDGER_PAIR_INVALID"
  | "REFUND_PRIOR_RECORDS_INVALID"
  | "REFUND_AMOUNT_EXCEEDS_REMAINING"
  | "REFUND_CUSTOMER_BALANCE_INVALID"
  | "REFUND_CUSTOMER_BALANCE_OVERFLOW"
  | "REFUND_VENDOR_BALANCE_INVALID"
  | "REFUND_VENDOR_BALANCE_INSUFFICIENT";

const refundErrorMessages = {
  REFUND_INVALID_COMMAND: "The refund command is invalid.",
  REFUND_ACTOR_NOT_ACTIVE_VENDOR:
    "An active vendor account is required to create a refund.",
  REFUND_VENDOR_NOT_FOUND:
    "The vendor profile for the refund actor could not be found.",
  REFUND_ORDER_NOT_FOUND: "The completed order could not be found.",
  REFUND_ORDER_NOT_COMPLETED: "Only completed orders can be refunded.",
  REFUND_ORDER_OWNERSHIP_MISMATCH:
    "The vendor account does not own the order being refunded.",
  REFUND_ORDER_RELATIONSHIPS_INVALID:
    "The order's customer, vendor, and wallet relationships are inconsistent.",
  REFUND_CUSTOMER_ACCOUNT_INVALID:
    "The order customer profile does not map to a customer account.",
  REFUND_WALLET_NOT_ACTIVE:
    "Both wallets associated with the order must be active.",
  REFUND_DUPLICATE_IDEMPOTENCY_KEY:
    "This refund submission has already been used.",
  REFUND_TRANSACTION_GROUP_COLLISION:
    "The generated refund transaction group is already in use.",
  REFUND_ORIGINAL_LEDGER_PAIR_INVALID:
    "The order's original paired ledger entries are unavailable or invalid.",
  REFUND_PRIOR_RECORDS_INVALID:
    "The order's prior refund records are inconsistent.",
  REFUND_AMOUNT_EXCEEDS_REMAINING:
    "The refund amount exceeds the order's remaining refundable tokens.",
  REFUND_CUSTOMER_BALANCE_INVALID:
    "The customer wallet's current ledger balance is invalid.",
  REFUND_CUSTOMER_BALANCE_OVERFLOW:
    "The refund would exceed the customer wallet's supported balance range.",
  REFUND_VENDOR_BALANCE_INVALID:
    "The vendor wallet's current ledger balance is invalid.",
  REFUND_VENDOR_BALANCE_INSUFFICIENT:
    "The vendor wallet does not have enough tokens for this refund.",
} as const satisfies Record<RefundServiceErrorCode, string>;

export class RefundServiceError extends Error {
  public constructor(public readonly code: RefundServiceErrorCode) {
    super(refundErrorMessages[code]);
    this.name = "RefundServiceError";
  }
}
