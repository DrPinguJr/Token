import { describe, expect, it, vi } from "vitest";

import {
  activeCustomer,
  activeCustomerAccount,
  openVendor,
} from "./qr-payment-test-fixtures";
import {
  VendorQrResolutionError,
  VendorQrResolver,
} from "./vendor-qr-resolution";

function createResolver(vendor = openVendor) {
  const getByPublicCode = vi.fn(async (publicCode: string) =>
    publicCode === vendor.publicCode ? vendor : null,
  );
  const resolver = new VendorQrResolver({
    accounts: {
      getById: vi.fn(async () => activeCustomerAccount),
    },
    customers: {
      getByAccountId: vi.fn(async () => activeCustomer),
    },
    vendors: { getByPublicCode },
  });

  return { getByPublicCode, resolver };
}

describe("VendorQrResolver", () => {
  it("resolves a canonical vendor payload to its opaque route target", async () => {
    const { getByPublicCode, resolver } = createResolver();

    await expect(
      resolver.resolveScannedPayload({
        actorAccountId: activeCustomerAccount.id,
        payload: "tokenly://qr/v1/vendor/vnd_8K2M4Q7P",
      }),
    ).resolves.toEqual({
      vendorId: openVendor.id,
      displayName: openVendor.displayName,
      operatingStatus: "open",
    });
    expect(getByPublicCode).toHaveBeenCalledWith(openVendor.publicCode);
  });

  it.each([
    "tokenly://qr/v1/customer/cus_7F3Q9K2M",
    "tokenly://qr/v2/vendor/vnd_8K2M4Q7P",
    "https://tokenly.local/vendor/vnd_8K2M4Q7P",
    "vnd_8K2M4Q7P",
  ])("rejects non-vendor or non-canonical scanned input", async (payload) => {
    const { getByPublicCode, resolver } = createResolver();

    await expect(
      resolver.resolveScannedPayload({
        actorAccountId: activeCustomerAccount.id,
        payload,
      }),
    ).rejects.toMatchObject({ code: "INVALID_VENDOR_QR" });
    expect(getByPublicCode).not.toHaveBeenCalled();
  });

  it("normalizes surrounding whitespace for manual vendor-code entry", async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveManualCode({
        actorAccountId: activeCustomerAccount.id,
        publicCode: "  vnd_8K2M4Q7P  ",
      }),
    ).resolves.toMatchObject({ vendorId: openVendor.id });
  });

  it("distinguishes a well-formed code with no matching local vendor", async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveManualCode({
        actorAccountId: activeCustomerAccount.id,
        publicCode: "vnd_9Z9Z9Z9Z",
      }),
    ).rejects.toEqual(
      new VendorQrResolutionError("VENDOR_CODE_NOT_FOUND"),
    );
  });

  it("does not query vendors when customer access is denied", async () => {
    const getByPublicCode = vi.fn(async () => openVendor);
    const resolver = new VendorQrResolver({
      accounts: {
        getById: vi.fn(async () => ({
          ...activeCustomerAccount,
          role: "staff" as const,
        })),
      },
      customers: {
        getByAccountId: vi.fn(async () => activeCustomer),
      },
      vendors: { getByPublicCode },
    });

    await expect(
      resolver.resolveManualCode({
        actorAccountId: activeCustomerAccount.id,
        publicCode: openVendor.publicCode,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_QR_ACCESS_DENIED" });
    expect(getByPublicCode).not.toHaveBeenCalled();
  });
});
