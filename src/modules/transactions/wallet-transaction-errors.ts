export class InvalidTokenAmountError extends Error {
  public readonly code = "INVALID_TOKEN_AMOUNT";

  public constructor(public readonly tokenAmount: number) {
    super("Token amount must be a positive safe integer.");
    this.name = "InvalidTokenAmountError";
  }
}

export class TransactionActorRequiredError extends Error {
  public readonly code = "TRANSACTION_ACTOR_REQUIRED";

  public constructor() {
    super("A valid actor account is required for a wallet transaction.");
    this.name = "TransactionActorRequiredError";
  }
}

export class DuplicateIdempotencyKeyError extends Error {
  public readonly code = "DUPLICATE_IDEMPOTENCY_KEY";

  public constructor(public readonly idempotencyKey: string) {
    super("This wallet operation has already been submitted.");
    this.name = "DuplicateIdempotencyKeyError";
  }
}

export class DuplicateTransactionGroupIdError extends Error {
  public readonly code = "DUPLICATE_TRANSACTION_GROUP_ID";

  public constructor(public readonly transactionGroupId: string) {
    super("This transaction group identifier is already in use.");
    this.name = "DuplicateTransactionGroupIdError";
  }
}

export class WalletBalanceOverflowError extends Error {
  public readonly code = "WALLET_BALANCE_OVERFLOW";

  public constructor() {
    super("The calculated wallet balance is outside the supported range.");
    this.name = "WalletBalanceOverflowError";
  }
}

export class NegativeWalletBalanceError extends Error {
  public readonly code = "NEGATIVE_WALLET_BALANCE";

  public constructor(public readonly balance: number) {
    super("A wallet balance cannot be negative.");
    this.name = "NegativeWalletBalanceError";
  }
}

export class InsufficientWalletBalanceError extends Error {
  public readonly code = "INSUFFICIENT_WALLET_BALANCE";

  public constructor(
    public readonly availableTokenAmount: number,
    public readonly requestedTokenAmount: number,
  ) {
    super("The wallet does not have enough tokens for this operation.");
    this.name = "InsufficientWalletBalanceError";
  }
}
