import type { Vendor, VendorRepository } from "@/modules/vendors";
import { z } from "zod";

import {
  type CustomerQrAccessRepositories,
  resolveActiveCustomerForQr,
} from "./customer-qr-access";
import {
  InvalidTokenlyQrPayloadError,
  parseTokenlyQrPayload,
  type TokenlyQrPayload,
  vendorQrPublicCodeSchema,
} from "./tokenly-qr-payload";

const scannedVendorQrCommandSchema = z
  .object({
    actorAccountId: z.string(),
    payload: z.unknown(),
  })
  .strict();

const manualVendorCodeCommandSchema = z
  .object({
    actorAccountId: z.string(),
    publicCode: z.unknown(),
  })
  .strict();

export interface VendorQrResolutionRepositories
  extends CustomerQrAccessRepositories {
  readonly vendors: Pick<VendorRepository, "getByPublicCode">;
}

export interface ResolvedVendorQrTarget {
  readonly vendorId: string;
  readonly displayName: string;
  readonly operatingStatus: Vendor["operatingStatus"];
}

export type VendorQrResolutionErrorCode =
  | "INVALID_VENDOR_QR"
  | "VENDOR_CODE_NOT_FOUND";

const vendorQrResolutionErrorMessages = {
  INVALID_VENDOR_QR: "The value is not a valid Tokenly vendor code.",
  VENDOR_CODE_NOT_FOUND: "No vendor matches that Tokenly code.",
} as const satisfies Record<VendorQrResolutionErrorCode, string>;

export class VendorQrResolutionError extends Error {
  public constructor(public readonly code: VendorQrResolutionErrorCode) {
    super(vendorQrResolutionErrorMessages[code]);
    this.name = "VendorQrResolutionError";
  }
}

function createResolvedVendorTarget(vendor: Vendor): ResolvedVendorQrTarget {
  return Object.freeze({
    vendorId: vendor.id,
    displayName: vendor.displayName,
    operatingStatus: vendor.operatingStatus,
  });
}

export class VendorQrResolver {
  public constructor(
    private readonly repositories: VendorQrResolutionRepositories,
  ) {}

  public async resolveScannedPayload(
    input: unknown,
  ): Promise<ResolvedVendorQrTarget> {
    const command = scannedVendorQrCommandSchema.parse(input);
    await resolveActiveCustomerForQr(
      command.actorAccountId,
      this.repositories,
    );

    let parsedPayload: TokenlyQrPayload;
    try {
      parsedPayload = parseTokenlyQrPayload(command.payload);
    } catch (error: unknown) {
      if (error instanceof InvalidTokenlyQrPayloadError) {
        throw new VendorQrResolutionError("INVALID_VENDOR_QR");
      }
      throw error;
    }

    if (parsedPayload.kind !== "vendor") {
      throw new VendorQrResolutionError("INVALID_VENDOR_QR");
    }

    return this.resolvePublicCode(parsedPayload.publicCode);
  }

  public async resolveManualCode(
    input: unknown,
  ): Promise<ResolvedVendorQrTarget> {
    const command = manualVendorCodeCommandSchema.parse(input);
    await resolveActiveCustomerForQr(
      command.actorAccountId,
      this.repositories,
    );
    const publicCode = vendorQrPublicCodeSchema.safeParse(command.publicCode);

    if (!publicCode.success) {
      throw new VendorQrResolutionError("INVALID_VENDOR_QR");
    }

    return this.resolvePublicCode(publicCode.data);
  }

  private async resolvePublicCode(
    publicCode: string,
  ): Promise<ResolvedVendorQrTarget> {
    const vendor = await this.repositories.vendors.getByPublicCode(publicCode);

    if (vendor === null) {
      throw new VendorQrResolutionError("VENDOR_CODE_NOT_FOUND");
    }

    return createResolvedVendorTarget(vendor);
  }
}
