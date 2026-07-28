import { describe, expect, it } from "vitest";

import { calculateIssuedTokenAmount } from "./calculate-issued-token-amount";

describe("calculateIssuedTokenAmount", () => {
  it("converts integer cents at the configured tokens-per-dollar rate", () => {
    expect(calculateIssuedTokenAmount(2_000, 10)).toBe(200);
  });

  it("rounds fractional token results down", () => {
    expect(calculateIssuedTokenAmount(199, 3)).toBe(5);
  });

  it("supports an exact maximum-safe conversion without intermediate overflow", () => {
    expect(calculateIssuedTokenAmount(100, Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    { amount: 0, rate: 10 },
    { amount: 100.5, rate: 10 },
    { amount: 100, rate: 0 },
  ])("rejects invalid integer inputs: $amount cents at $rate", (input) => {
    expect(() =>
      calculateIssuedTokenAmount(input.amount, input.rate),
    ).toThrowError(
      expect.objectContaining({
        code: "TOKEN_ISSUANCE_CONVERSION_INPUT_INVALID",
      }),
    );
  });

  it("rejects a positive amount that converts below one token", () => {
    expect(() => calculateIssuedTokenAmount(1, 10)).toThrowError(
      expect.objectContaining({
        code: "TOKEN_ISSUANCE_CONVERSION_BELOW_MINIMUM",
      }),
    );
  });

  it("rejects a converted amount outside the safe integer range", () => {
    expect(() =>
      calculateIssuedTokenAmount(101, Number.MAX_SAFE_INTEGER),
    ).toThrowError(
      expect.objectContaining({
        code: "TOKEN_ISSUANCE_CONVERSION_OVERFLOW",
      }),
    );
  });
});
