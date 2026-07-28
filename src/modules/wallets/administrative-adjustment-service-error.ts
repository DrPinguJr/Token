export type AdministrativeAdjustmentServiceErrorCode =
  | "ADJUSTMENT_INVALID_COMMAND"
  | "ADJUSTMENT_ACTOR_NOT_ACTIVE_ADMINISTRATOR"
  | "ADJUSTMENT_WALLET_NOT_FOUND"
  | "ADJUSTMENT_WALLET_NOT_ACTIVE"
  | "ADJUSTMENT_WALLET_OWNER_INVALID"
  | "ADJUSTMENT_DUPLICATE_IDEMPOTENCY_KEY"
  | "ADJUSTMENT_TRANSACTION_GROUP_COLLISION"
  | "ADJUSTMENT_CURRENT_BALANCE_INVALID"
  | "ADJUSTMENT_WALLET_BALANCE_INSUFFICIENT"
  | "ADJUSTMENT_RESULTING_BALANCE_UNSAFE";

const administrativeAdjustmentErrorMessages = {
  ADJUSTMENT_INVALID_COMMAND:
    "The administrative adjustment command is invalid.",
  ADJUSTMENT_ACTOR_NOT_ACTIVE_ADMINISTRATOR:
    "An active administrator account is required for an adjustment.",
  ADJUSTMENT_WALLET_NOT_FOUND: "The adjustment wallet could not be found.",
  ADJUSTMENT_WALLET_NOT_ACTIVE:
    "Administrative adjustments require an active wallet.",
  ADJUSTMENT_WALLET_OWNER_INVALID:
    "The wallet does not map to its declared owner account and profile.",
  ADJUSTMENT_DUPLICATE_IDEMPOTENCY_KEY:
    "This administrative adjustment submission has already been used.",
  ADJUSTMENT_TRANSACTION_GROUP_COLLISION:
    "The generated adjustment transaction group is already in use.",
  ADJUSTMENT_CURRENT_BALANCE_INVALID:
    "The wallet's current ledger balance is invalid.",
  ADJUSTMENT_WALLET_BALANCE_INSUFFICIENT:
    "The wallet does not have enough tokens for this debit adjustment.",
  ADJUSTMENT_RESULTING_BALANCE_UNSAFE:
    "The resulting wallet balance exceeds the supported safe-integer range.",
} as const satisfies Record<AdministrativeAdjustmentServiceErrorCode, string>;

export class AdministrativeAdjustmentServiceError extends Error {
  public constructor(
    public readonly code: AdministrativeAdjustmentServiceErrorCode,
  ) {
    super(administrativeAdjustmentErrorMessages[code]);
    this.name = "AdministrativeAdjustmentServiceError";
  }
}
