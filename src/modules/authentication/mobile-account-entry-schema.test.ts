import { describe, expect, it } from "vitest";

import { accountEntrySchema } from "./mobile-account-entry-schema";

describe("accountEntrySchema", () => {
  it("accepts a local operational username and password", () => {
    expect(
      accountEntrySchema.parse({
        username: "AdminLance",
        password: "Lance888!",
      }),
    ).toEqual({
      username: "AdminLance",
      password: "Lance888!",
    });
  });

  it.each([
    [{ username: "", password: "Lance888!" }, "Enter your username."],
    [
      { username: "90000001", password: "Lance888!" },
      "Enter a valid username.",
    ],
    [
      { username: "Admin Lance", password: "Lance888!" },
      "Enter a valid username.",
    ],
    [{ username: "AdminLance", password: "" }, "Enter your password."],
  ])("rejects invalid credential input", (input, message) => {
    const result = accountEntrySchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
