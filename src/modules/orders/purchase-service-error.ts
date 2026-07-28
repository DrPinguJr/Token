export type PurchaseServiceErrorCode =
  | "PURCHASE_INVALID_COMMAND"
  | "PURCHASE_ACTOR_NOT_AUTHORIZED"
  | "PURCHASE_CUSTOMER_UNAVAILABLE"
  | "PURCHASE_VENDOR_UNAVAILABLE"
  | "PURCHASE_VENDOR_CLOSED"
  | "PURCHASE_CUSTOMER_WALLET_UNAVAILABLE"
  | "PURCHASE_VENDOR_WALLET_UNAVAILABLE"
  | "PURCHASE_DUPLICATE_SUBMISSION"
  | "PURCHASE_PRODUCT_UNAVAILABLE"
  | "PURCHASE_TOTAL_OUT_OF_RANGE"
  | "PURCHASE_CUSTOMER_WALLET_INVALID"
  | "PURCHASE_VENDOR_WALLET_INVALID"
  | "PURCHASE_VENDOR_BALANCE_OVERFLOW"
  | "PURCHASE_INSUFFICIENT_BALANCE"
  | "PURCHASE_TRANSACTION_GROUP_COLLISION"
  | "PURCHASE_RECORD_IDENTITY_INVALID";

const purchaseErrorMessages = {
  PURCHASE_INVALID_COMMAND: "The purchase command is invalid.",
  PURCHASE_ACTOR_NOT_AUTHORIZED:
    "An active customer account is required for this purchase.",
  PURCHASE_CUSTOMER_UNAVAILABLE: "The customer is unavailable.",
  PURCHASE_VENDOR_UNAVAILABLE: "The vendor is unavailable.",
  PURCHASE_VENDOR_CLOSED: "The vendor is not open for purchases.",
  PURCHASE_CUSTOMER_WALLET_UNAVAILABLE:
    "The customer wallet is unavailable for purchases.",
  PURCHASE_VENDOR_WALLET_UNAVAILABLE:
    "The vendor wallet is unavailable for purchases.",
  PURCHASE_DUPLICATE_SUBMISSION:
    "This purchase submission has already been used.",
  PURCHASE_PRODUCT_UNAVAILABLE:
    "One or more selected products are unavailable.",
  PURCHASE_TOTAL_OUT_OF_RANGE:
    "The authoritative purchase total is outside the supported range.",
  PURCHASE_CUSTOMER_WALLET_INVALID:
    "The customer wallet ledger cannot produce a valid spendable balance.",
  PURCHASE_VENDOR_WALLET_INVALID:
    "The vendor wallet ledger cannot produce a valid non-negative balance.",
  PURCHASE_VENDOR_BALANCE_OVERFLOW:
    "The vendor wallet balance would exceed the supported range.",
  PURCHASE_INSUFFICIENT_BALANCE:
    "The customer wallet does not have enough tokens for this purchase.",
  PURCHASE_TRANSACTION_GROUP_COLLISION:
    "The generated purchase transaction group is already in use.",
  PURCHASE_RECORD_IDENTITY_INVALID:
    "The purchase record identities are invalid.",
} as const satisfies Record<PurchaseServiceErrorCode, string>;

export class PurchaseServiceError extends Error {
  public constructor(public readonly code: PurchaseServiceErrorCode) {
    super(purchaseErrorMessages[code]);
    this.name = "PurchaseServiceError";
  }
}
