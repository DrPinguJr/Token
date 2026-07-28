import { describe, expect, it } from "vitest";

import {
  accountEntrySchema,
  normalizeAccountEntryMobileNumber,
} from "./mobile-account-entry-schema";

describe("accountEntrySchema", () => {
  it.each([
    ["9000 0001", "90000001"],
    ["(9000) 0001", "90000001"],
    ["+65 9000-0001", "90000001"],
    ["65 9000 0001", "90000001"],
    ["123456789012345", "123456789012345"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(accountEntrySchema.parse({ mobileNumber: input })).toEqual({
      mobileNumber: expected,
    });
  });

  it.each(["", "9000ABC1", "1234567", "1234567890123456", "++6590000001"])(
    "rejects invalid input without broad character coercion: %s",
    (mobileNumber) => {
      expect(accountEntrySchema.safeParse({ mobileNumber }).success).toBe(
        false,
      );
    },
  );
});

describe("normalizeAccountEntryMobileNumber", () => {
  it("does not remove arbitrary characters", () => {
    expect(normalizeAccountEntryMobileNumber("9000.ABC1")).toBe("9000.ABC1");
  });
});
