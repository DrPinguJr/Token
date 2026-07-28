import { describe, expect, it } from "vitest";

import {
  jsonObjectSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

describe("shared domain schemas", () => {
  it("accepts finite JSON-compatible metadata", () => {
    expect(
      jsonObjectSchema.safeParse({
        source: "seed",
        nested: { count: 2, flags: [true, null] },
      }).success,
    ).toBe(true);
  });

  it("rejects non-JSON values", () => {
    expect(jsonObjectSchema.safeParse({ unsafe: undefined }).success).toBe(
      false,
    );
    expect(jsonObjectSchema.safeParse({ unsafe: Number.NaN }).success).toBe(
      false,
    );
  });

  it("requires UTC timestamps and positive safe integers", () => {
    expect(
      utcTimestampSchema.safeParse("2026-07-27T04:00:00.000Z").success,
    ).toBe(true);
    expect(
      utcTimestampSchema.safeParse("2026-07-27T12:00:00+08:00").success,
    ).toBe(false);
    expect(positiveSafeIntegerSchema.safeParse(1).success).toBe(true);
    expect(
      positiveSafeIntegerSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success,
    ).toBe(false);
  });
});
