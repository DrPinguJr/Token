export class CustomerAccessCodeGenerationError extends Error {
  public readonly code = "CUSTOMER_ACCESS_CODE_GENERATION_FAILED";

  public constructor() {
    super("A customer access code could not be generated.");
    this.name = "CustomerAccessCodeGenerationError";
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function generateCustomerAccessCode(prefix: string): string {
  if (
    typeof globalThis.crypto !== "object" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new CustomerAccessCodeGenerationError();
  }

  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${toBase64Url(bytes)}`;
}

export function generateNumericCustomerAccessCode(length = 32): string {
  if (
    typeof globalThis.crypto !== "object" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new CustomerAccessCodeGenerationError();
  }

  let value = "";
  const bytes = new Uint8Array(length * 2);

  while (value.length < length) {
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte < 250) {
        value += String(byte % 10);
        if (value.length === length) {
          break;
        }
      }
    }
  }

  return value;
}

export function buildClaimPath(claimCode: string): string {
  return `/claim/${encodeURIComponent(claimCode)}`;
}

export function buildPrivateAccountPath(privateAccessCode: string): string {
  return `/card/${encodeURIComponent(privateAccessCode)}`;
}
