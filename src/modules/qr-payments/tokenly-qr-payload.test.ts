import { describe, expect, it } from "vitest";

import {
  buildTokenlyQrPayload,
  InvalidTokenlyQrPayloadError,
  parseTokenlyQrPayload,
} from "./tokenly-qr-payload";

describe("Tokenly QR payload", () => {
  it.each([
    {
      version: 1 as const,
      kind: "customer" as const,
      publicCode: "cus_7F3Q9K2M",
      encoded: "tokenly://qr/v1/customer/cus_7F3Q9K2M",
    },
    {
      version: 1 as const,
      kind: "vendor" as const,
      publicCode: "vnd_8K2M4Q7P",
      encoded: "tokenly://qr/v1/vendor/vnd_8K2M4Q7P",
    },
  ])("round-trips a strict $kind payload", (fixture) => {
    const encoded = buildTokenlyQrPayload(fixture);

    expect(encoded).toBe(fixture.encoded);
    expect(parseTokenlyQrPayload(encoded)).toEqual({
      version: fixture.version,
      kind: fixture.kind,
      publicCode: fixture.publicCode,
    });
  });

  it("rejects private or unrecognised fields at the builder boundary", () => {
    expect(() =>
      buildTokenlyQrPayload({
        version: 1,
        kind: "customer",
        publicCode: "cus_7F3Q9K2M",
        mobileNumber: "90000001",
        balance: 128,
        pin: "2468",
        permissions: ["wallet:write"],
      }),
    ).toThrow(InvalidTokenlyQrPayloadError);
  });

  it.each([
    " tokenly://qr/v1/vendor/vnd_8K2M4Q7P",
    "TOKENLY://qr/v1/vendor/vnd_8K2M4Q7P",
    "tokenly://qr.evil/v1/vendor/vnd_8K2M4Q7P",
    "tokenly://qr/v2/vendor/vnd_8K2M4Q7P",
    "tokenly://qr/v1/customer/vnd_8K2M4Q7P",
    "tokenly://qr/v1/vendor/cus_7F3Q9K2M",
    "tokenly://qr/v1/vendor/vnd_8K2M4Q7P/extra",
    "tokenly://qr/v1/vendor/vnd_8K2M4Q7P?account=private",
    "tokenly://qr/v1/vendor/vnd_8K2M4Q7P#permissions",
    "https://tokenly.local/v1/vendor/vnd_8K2M4Q7P",
    "vnd_8K2M4Q7P",
    "",
  ])("rejects a non-canonical payload: %s", (payload) => {
    expect(() => parseTokenlyQrPayload(payload)).toThrow(
      InvalidTokenlyQrPayloadError,
    );
  });
});
