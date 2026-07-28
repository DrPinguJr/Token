export type TokenIssuanceErrorCode =
  | "TOKEN_ISSUANCE_COMMAND_INVALID"
  | "TOKEN_ISSUANCE_CONVERSION_BELOW_MINIMUM"
  | "TOKEN_ISSUANCE_CONVERSION_INPUT_INVALID"
  | "TOKEN_ISSUANCE_CONVERSION_OVERFLOW"
  | "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_INACTIVE"
  | "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_MISMATCH"
  | "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_NOT_FOUND"
  | "TOKEN_ISSUANCE_CUSTOMER_NOT_FOUND"
  | "TOKEN_ISSUANCE_DUPLICATE_PAYMENT_REFERENCE_ACKNOWLEDGEMENT_REQUIRED"
  | "TOKEN_ISSUANCE_EVIDENCE_INVALID"
  | "TOKEN_ISSUANCE_EVENT_SETTINGS_NOT_FOUND"
  | "TOKEN_ISSUANCE_STAFF_ACCOUNT_INACTIVE"
  | "TOKEN_ISSUANCE_STAFF_ACCOUNT_NOT_FOUND"
  | "TOKEN_ISSUANCE_STAFF_ROLE_REQUIRED"
  | "TOKEN_ISSUANCE_WALLET_INACTIVE"
  | "TOKEN_ISSUANCE_WALLET_NOT_FOUND"
  | "TOKEN_ISSUANCE_WALLET_OWNERSHIP_MISMATCH";

export class TokenIssuanceError extends Error {
  public constructor(
    public readonly code: TokenIssuanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TokenIssuanceError";
  }
}

export class TokenIssuanceCommandValidationError extends TokenIssuanceError {
  public constructor(public readonly issuePaths: readonly string[]) {
    super(
      "TOKEN_ISSUANCE_COMMAND_INVALID",
      "The token issuance command is invalid.",
    );
    this.name = "TokenIssuanceCommandValidationError";
  }
}

export class TokenIssuanceEvidenceValidationError extends TokenIssuanceError {
  public constructor(public readonly issuePaths: readonly string[]) {
    super(
      "TOKEN_ISSUANCE_EVIDENCE_INVALID",
      "The local payment evidence is invalid.",
    );
    this.name = "TokenIssuanceEvidenceValidationError";
  }
}

export class DuplicatePaymentReferenceAcknowledgementRequiredError extends TokenIssuanceError {
  public constructor(public readonly matchingIssuanceCount: number) {
    super(
      "TOKEN_ISSUANCE_DUPLICATE_PAYMENT_REFERENCE_ACKNOWLEDGEMENT_REQUIRED",
      "This payment reference was used before and requires explicit acknowledgement.",
    );
    this.name = "DuplicatePaymentReferenceAcknowledgementRequiredError";
  }
}
