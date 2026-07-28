export type CustomerOnboardingServiceErrorCode =
  | "ONBOARDING_ACCOUNT_NOT_AUTHORIZED"
  | "ONBOARDING_CUSTOMER_NOT_FOUND"
  | "ONBOARDING_DEVELOPMENT_SKIP_DISABLED";

const messages = {
  ONBOARDING_ACCOUNT_NOT_AUTHORIZED:
    "The current account cannot complete customer onboarding.",
  ONBOARDING_CUSTOMER_NOT_FOUND:
    "The customer profile required for onboarding was not found.",
  ONBOARDING_DEVELOPMENT_SKIP_DISABLED:
    "The onboarding skip is available only when development tools are enabled.",
} as const satisfies Record<CustomerOnboardingServiceErrorCode, string>;

export class CustomerOnboardingServiceError extends Error {
  public constructor(public readonly code: CustomerOnboardingServiceErrorCode) {
    super(messages[code]);
    this.name = "CustomerOnboardingServiceError";
  }
}
