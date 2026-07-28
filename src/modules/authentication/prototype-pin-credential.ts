import { walletPinSchema } from "./pin-command-schema";

const prototypePinCredentialPrefix = "prototype-sha256-v1$";
const sha256LowercaseHexLength = 64;
const prototypePinCredentialLength =
  prototypePinCredentialPrefix.length + sha256LowercaseHexLength;

export const dummyPrototypePinCredential = `${prototypePinCredentialPrefix}${"0".repeat(sha256LowercaseHexLength)}`;

export class PinCredentialDerivationUnavailableError extends Error {
  public readonly code = "PIN_CREDENTIAL_DERIVATION_UNAVAILABLE";

  public constructor() {
    super("PIN credential derivation is unavailable.");
    this.name = "PinCredentialDerivationUnavailableError";
  }
}

function getBrowserSubtleCrypto(): SubtleCrypto {
  if (
    typeof globalThis.crypto !== "object" ||
    typeof globalThis.crypto.subtle !== "object"
  ) {
    throw new PinCredentialDerivationUnavailableError();
  }

  return globalThis.crypto.subtle;
}

function bytesToLowercaseHex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Derives Tokenly's deliberately simple local-prototype credential.
 *
 * Production must replace this unsalted browser digest with server-side
 * password hashing and rate limiting.
 */
export async function derivePrototypePinCredential(
  input: unknown,
): Promise<string> {
  const pin = walletPinSchema.parse(input);
  const digest = await getBrowserSubtleCrypto().digest(
    "SHA-256",
    new TextEncoder().encode(pin),
  );

  return `${prototypePinCredentialPrefix}${bytesToLowercaseHex(
    new Uint8Array(digest),
  )}`;
}

function fixedShapeCharacterCode(value: string, index: number): number {
  const code = value.charCodeAt(index);
  return Number.isNaN(code) ? 0 : code;
}

/**
 * Compares the fixed prototype credential shape without an early mismatch
 * return. JavaScript cannot provide a production-grade constant-time
 * guarantee, but this keeps local comparison work independent of the first
 * differing character.
 */
export function constantShapePrototypeCredentialEquals(
  left: string,
  right: string,
): boolean {
  let difference = left.length ^ right.length;

  for (let index = 0; index < prototypePinCredentialLength; index += 1) {
    difference |=
      fixedShapeCharacterCode(left, index) ^
      fixedShapeCharacterCode(right, index);
  }

  return difference === 0;
}
