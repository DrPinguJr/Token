import { describe, expect, it } from "vitest";

import { InvalidTokenlyQrPayloadError } from "@/modules/qr-payments";

import { generateTokenlyQrCodeDataUrl } from "./qr-code-image-generator";

describe("generateTokenlyQrCodeDataUrl", () => {
  it("renders a validated canonical payload as a PNG data URL", async () => {
    const dataUrl = await generateTokenlyQrCodeDataUrl(
      "tokenly://qr/v1/customer/cus_7F3Q9K2M",
    );

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects arbitrary content before handing it to the renderer", async () => {
    await expect(
      generateTokenlyQrCodeDataUrl("mobile=90000001&pin=2468"),
    ).rejects.toBeInstanceOf(InvalidTokenlyQrPayloadError);
  });
});
