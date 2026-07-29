import { describe, expect, it } from "vitest";

import { parseTokenlyAccessQrPath } from "./enter-qr-mode";

const origin = "https://tokenly.example";

describe("parseTokenlyAccessQrPath", () => {
  it("accepts same-origin claim and private-account routes", () => {
    expect(
      parseTokenlyAccessQrPath(
        "https://tokenly.example/claim/claim_ABC123",
        origin,
      ),
    ).toBe("/claim/claim_ABC123");
    expect(parseTokenlyAccessQrPath("/card/1234567890", origin)).toBe(
      "/card/1234567890",
    );
  });

  it("rejects wallet payloads, external origins, and modified routes", () => {
    expect(
      parseTokenlyAccessQrPath("tokenly://qr/v1/customer/cus_public", origin),
    ).toBeNull();
    expect(
      parseTokenlyAccessQrPath(
        "https://untrusted.example/claim/claim_ABC123",
        origin,
      ),
    ).toBeNull();
    expect(
      parseTokenlyAccessQrPath("/claim/claim_ABC123?redirect=bad", origin),
    ).toBeNull();
  });
});
