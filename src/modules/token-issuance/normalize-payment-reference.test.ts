import { describe, expect, it } from "vitest";

import { normalizePaymentReference } from "./normalize-payment-reference";

describe("normalizePaymentReference", () => {
  it("normalizes casing, surrounding space, internal whitespace, and Unicode width", () => {
    expect(normalizePaymentReference("  ＰＮ-ABC   123  ")).toBe("pn-abc 123");
  });
});
