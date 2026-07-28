import { describe, expect, it } from "vitest";

import {
  accountPinCredentialSchema,
  accountSchema,
  type AccountSummary,
} from "@/modules/accounts";

const accountSummary = {
  id: "account-customer-001",
  mobileNumber: "90000001",
  displayName: "Avery Lim",
  role: "customer",
  status: "active",
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
} as const satisfies AccountSummary;

const accountPinCredential = {
  accountId: accountSummary.id,
  pinCredential: "local-prototype-credential",
  failedPinAttempts: 0,
  lockedUntil: null,
} as const;

describe("account boundary schemas", () => {
  it("keeps normal account records credential-free", () => {
    const result = accountSchema.safeParse(accountSummary);

    expect(result.success).toBe(true);
    if (result.success) {
      expect("pinCredential" in result.data).toBe(false);
      expect("failedPinAttempts" in result.data).toBe(false);
      expect("lockedUntil" in result.data).toBe(false);
    }
  });

  it("rejects credential state supplied through the normal account schema", () => {
    expect(
      accountSchema.safeParse({
        ...accountSummary,
        ...accountPinCredential,
      }).success,
    ).toBe(false);
  });

  it("accepts only the minimal credential verification record", () => {
    expect(
      accountPinCredentialSchema.safeParse(accountPinCredential).success,
    ).toBe(true);
    expect(
      accountPinCredentialSchema.safeParse({
        ...accountPinCredential,
        displayName: accountSummary.displayName,
      }).success,
    ).toBe(false);
  });

  it("models an unconfigured PIN without lockout state", () => {
    expect(
      accountPinCredentialSchema.safeParse({
        ...accountPinCredential,
        pinCredential: null,
      }).success,
    ).toBe(true);
    expect(
      accountPinCredentialSchema.safeParse({
        ...accountPinCredential,
        pinCredential: null,
        failedPinAttempts: 1,
      }).success,
    ).toBe(false);
    expect(
      accountPinCredentialSchema.safeParse({
        ...accountPinCredential,
        pinCredential: null,
        lockedUntil: "2026-07-27T00:05:00.000Z",
      }).success,
    ).toBe(false);
  });
});
