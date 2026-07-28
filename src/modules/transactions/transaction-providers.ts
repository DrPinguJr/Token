export type TransactionRecordType =
  | "audit-log"
  | "evidence"
  | "evidence-content"
  | "ledger-entry"
  | "order"
  | "refund"
  | "settlement"
  | "token-issuance";

export type TransactionReferenceType =
  "adjustment" | "issuance" | "order" | "refund" | "settlement";

export interface TransactionClock {
  now(): string;
}

export interface TransactionIdProvider {
  generateId(recordType: TransactionRecordType): string;
}

export interface TransactionGroupIdProvider {
  generateTransactionGroupId(): string;
}

export interface TransactionReferenceProvider {
  generateReference(referenceType: TransactionReferenceType): string;
}

export class TransactionIdentityUnavailableError extends Error {
  public readonly code = "TRANSACTION_IDENTITY_UNAVAILABLE";

  public constructor() {
    super("A secure transaction identity could not be generated.");
    this.name = "TransactionIdentityUnavailableError";
  }
}

const referencePrefixes = {
  adjustment: "ADJ",
  issuance: "ISS",
  order: "ORD",
  refund: "REF",
  settlement: "SET",
} as const satisfies Record<TransactionReferenceType, string>;

function generateUuid(): string {
  if (
    typeof globalThis.crypto !== "object" ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    throw new TransactionIdentityUnavailableError();
  }

  return globalThis.crypto.randomUUID();
}

export const systemTransactionClock: TransactionClock = Object.freeze({
  now: () => new Date().toISOString(),
});

export const cryptoTransactionIdProvider: TransactionIdProvider = Object.freeze(
  {
    generateId: (recordType: TransactionRecordType) =>
      `${recordType}:${generateUuid()}`,
  },
);

export const cryptoTransactionGroupIdProvider: TransactionGroupIdProvider =
  Object.freeze({
    generateTransactionGroupId: () => `transaction:${generateUuid()}`,
  });

export const cryptoTransactionReferenceProvider: TransactionReferenceProvider =
  Object.freeze({
    generateReference: (referenceType: TransactionReferenceType) =>
      `${referencePrefixes[referenceType]}-${generateUuid().replaceAll("-", "").toUpperCase()}`,
  });
