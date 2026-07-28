export type CustomerCommerceErrorCode =
  | "CUSTOMER_COMMERCE_INVALID_QUERY"
  | "CUSTOMER_COMMERCE_VENDOR_UNAVAILABLE"
  | "CUSTOMER_COMMERCE_CUSTOMER_UNAVAILABLE"
  | "CUSTOMER_COMMERCE_WALLET_UNAVAILABLE"
  | "CUSTOMER_COMMERCE_BALANCE_UNAVAILABLE"
  | "CUSTOMER_COMMERCE_PRODUCT_UNAVAILABLE"
  | "CUSTOMER_PURCHASE_INVALID"
  | "CUSTOMER_PURCHASE_PIN_FAILED"
  | "CUSTOMER_PURCHASE_PIN_LOCKED"
  | "CUSTOMER_PURCHASE_AUTHORIZATION_INVALID"
  | "CUSTOMER_PURCHASE_INSUFFICIENT_BALANCE"
  | "CUSTOMER_PURCHASE_DUPLICATE"
  | "CUSTOMER_PURCHASE_VENDOR_CLOSED"
  | "CUSTOMER_PURCHASE_PRODUCT_UNAVAILABLE"
  | "CUSTOMER_PURCHASE_UNAVAILABLE";

const customerCommerceErrorMessages = {
  CUSTOMER_COMMERCE_INVALID_QUERY:
    "The requested customer commerce view is invalid.",
  CUSTOMER_COMMERCE_VENDOR_UNAVAILABLE: "That vendor is unavailable.",
  CUSTOMER_COMMERCE_CUSTOMER_UNAVAILABLE:
    "Your customer profile is unavailable.",
  CUSTOMER_COMMERCE_WALLET_UNAVAILABLE: "Your wallet is unavailable.",
  CUSTOMER_COMMERCE_BALANCE_UNAVAILABLE:
    "Your wallet balance could not be calculated.",
  CUSTOMER_COMMERCE_PRODUCT_UNAVAILABLE:
    "One or more basket items are no longer available.",
  CUSTOMER_PURCHASE_INVALID: "The payment request is invalid.",
  CUSTOMER_PURCHASE_PIN_FAILED: "PIN verification failed.",
  CUSTOMER_PURCHASE_PIN_LOCKED:
    "PIN entry is temporarily unavailable. Try again later.",
  CUSTOMER_PURCHASE_AUTHORIZATION_INVALID:
    "The payment authorization could not be completed.",
  CUSTOMER_PURCHASE_INSUFFICIENT_BALANCE: "Not enough tokens.",
  CUSTOMER_PURCHASE_DUPLICATE:
    "This payment was already submitted. Check your transactions before trying again.",
  CUSTOMER_PURCHASE_VENDOR_CLOSED:
    "This vendor is not open for payments right now.",
  CUSTOMER_PURCHASE_PRODUCT_UNAVAILABLE:
    "One or more basket items changed or are no longer available.",
  CUSTOMER_PURCHASE_UNAVAILABLE:
    "Payment could not be completed. Your basket is still here.",
} as const satisfies Record<CustomerCommerceErrorCode, string>;

export class CustomerCommerceError extends Error {
  public readonly code: CustomerCommerceErrorCode;
  public readonly lockedUntil: string | null;

  public constructor(
    code: CustomerCommerceErrorCode,
    options: { readonly lockedUntil?: string } = {},
  ) {
    super(customerCommerceErrorMessages[code]);
    this.name = "CustomerCommerceError";
    this.code = code;
    this.lockedUntil = options.lockedUntil ?? null;
  }
}

export function getCustomerCommerceErrorMessage(error: unknown): string {
  return error instanceof CustomerCommerceError
    ? customerCommerceErrorMessages[error.code]
    : customerCommerceErrorMessages.CUSTOMER_PURCHASE_UNAVAILABLE;
}
