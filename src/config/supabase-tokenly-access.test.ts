import { describe, expect, it } from "vitest";

import { createTokenerSchema } from "@/modules/customer-access";

describe("createTokenerSchema", () => {
  it.each([
    ["91234567", "91234567"],
    ["9123 4567", "91234567"],
    ["+65 9123 4567", "91234567"],
    ["(+65) 9123-4567", "91234567"],
  ])("normalizes Singapore mobile number %s", (input, expected) => {
    expect(
      createTokenerSchema.parse({
        displayName: "Test Customer",
        mobileNumber: input,
      }),
    ).toEqual({
      displayName: "Test Customer",
      mobileNumber: expected,
    });
  });

  it.each(["", "12345678", "71234567", "+65 9123 456", "912345678"])(
    "rejects invalid mobile number %s",
    (mobileNumber) => {
      expect(
        createTokenerSchema.safeParse({
          displayName: "Test Customer",
          mobileNumber,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects the legacy NRIC input shape", () => {
    expect(
      createTokenerSchema.safeParse({
        displayName: "Test Customer",
        nric: "S1234567A",
      }).success,
    ).toBe(false);
  });
});
