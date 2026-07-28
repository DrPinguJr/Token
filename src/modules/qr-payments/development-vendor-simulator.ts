import type { VendorRepository } from "@/modules/vendors";
import { domainIdSchema } from "@/shared/validation";

import {
  type CustomerQrAccessRepositories,
  resolveActiveCustomerForQr,
} from "./customer-qr-access";
import {
  type ResolvedVendorQrTarget,
  VendorQrResolutionError,
} from "./vendor-qr-resolution";

export interface DevelopmentVendorSimulatorRepositories extends CustomerQrAccessRepositories {
  readonly vendors: Pick<VendorRepository, "getById" | "list">;
}

export interface DevelopmentVendorOption {
  readonly vendorId: string;
  readonly displayName: string;
  readonly stallLocation: string;
  readonly operatingStatus: "open" | "closed" | "paused";
}

export class DevelopmentVendorSimulatorDisabledError extends Error {
  public readonly code = "DEVELOPMENT_VENDOR_SIMULATOR_DISABLED";

  public constructor() {
    super("The development vendor simulator is disabled.");
    this.name = "DevelopmentVendorSimulatorDisabledError";
  }
}

export interface DevelopmentVendorSimulatorDependencies {
  readonly isDevelopmentToolsEnabled: () => boolean;
  readonly repositories: DevelopmentVendorSimulatorRepositories;
}

export class DevelopmentVendorSimulator {
  public constructor(
    private readonly dependencies: DevelopmentVendorSimulatorDependencies,
  ) {}

  public async listOptions(
    actorAccountId: unknown,
  ): Promise<readonly DevelopmentVendorOption[]> {
    this.assertEnabled();
    await resolveActiveCustomerForQr(
      actorAccountId,
      this.dependencies.repositories,
    );
    const vendors = await this.dependencies.repositories.vendors.list();

    return vendors
      .map((vendor) =>
        Object.freeze({
          vendorId: vendor.id,
          displayName: vendor.displayName,
          stallLocation: vendor.stallLocation,
          operatingStatus: vendor.operatingStatus,
        }),
      )
      .sort(
        (left, right) =>
          left.displayName.localeCompare(right.displayName) ||
          left.vendorId.localeCompare(right.vendorId),
      );
  }

  public async resolveSelection(
    actorAccountId: unknown,
    vendorIdInput: unknown,
  ): Promise<ResolvedVendorQrTarget> {
    this.assertEnabled();
    await resolveActiveCustomerForQr(
      actorAccountId,
      this.dependencies.repositories,
    );
    const vendorId = domainIdSchema.safeParse(vendorIdInput);

    if (!vendorId.success) {
      throw new VendorQrResolutionError("VENDOR_CODE_NOT_FOUND");
    }

    const vendor = await this.dependencies.repositories.vendors.getById(
      vendorId.data,
    );

    if (vendor === null) {
      throw new VendorQrResolutionError("VENDOR_CODE_NOT_FOUND");
    }

    return Object.freeze({
      vendorId: vendor.id,
      displayName: vendor.displayName,
      operatingStatus: vendor.operatingStatus,
    });
  }

  private assertEnabled(): void {
    if (!this.dependencies.isDevelopmentToolsEnabled()) {
      throw new DevelopmentVendorSimulatorDisabledError();
    }
  }
}
