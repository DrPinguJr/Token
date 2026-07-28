import { describe, expect, it, vi } from "vitest";

import {
  activeCustomer,
  activeCustomerAccount,
  openVendor,
  pausedVendor,
} from "./qr-payment-test-fixtures";
import {
  DevelopmentVendorSimulator,
  DevelopmentVendorSimulatorDisabledError,
} from "./development-vendor-simulator";

function createSimulator(enabled: boolean) {
  const getById = vi.fn(async (vendorId: string) =>
    vendorId === openVendor.id ? openVendor : null,
  );
  const list = vi.fn(async () => [pausedVendor, openVendor]);
  const getAccountById = vi.fn(async () => activeCustomerAccount);
  const getCustomerByAccountId = vi.fn(async () => activeCustomer);
  const simulator = new DevelopmentVendorSimulator({
    isDevelopmentToolsEnabled: () => enabled,
    repositories: {
      accounts: { getById: getAccountById },
      customers: { getByAccountId: getCustomerByAccountId },
      vendors: { getById, list },
    },
  });

  return {
    getAccountById,
    getById,
    getCustomerByAccountId,
    list,
    simulator,
  };
}

describe("DevelopmentVendorSimulator", () => {
  it("gates both list and selection actions before any repository access", async () => {
    const dependencies = createSimulator(false);

    await expect(
      dependencies.simulator.listOptions(activeCustomerAccount.id),
    ).rejects.toBeInstanceOf(DevelopmentVendorSimulatorDisabledError);
    await expect(
      dependencies.simulator.resolveSelection(
        activeCustomerAccount.id,
        openVendor.id,
      ),
    ).rejects.toBeInstanceOf(DevelopmentVendorSimulatorDisabledError);

    expect(dependencies.getAccountById).not.toHaveBeenCalled();
    expect(dependencies.getCustomerByAccountId).not.toHaveBeenCalled();
    expect(dependencies.list).not.toHaveBeenCalled();
    expect(dependencies.getById).not.toHaveBeenCalled();
  });

  it("returns sorted, credential-free development choices when enabled", async () => {
    const { simulator } = createSimulator(true);

    await expect(
      simulator.listOptions(activeCustomerAccount.id),
    ).resolves.toEqual([
      {
        vendorId: openVendor.id,
        displayName: openVendor.displayName,
        stallLocation: openVendor.stallLocation,
        operatingStatus: openVendor.operatingStatus,
      },
      {
        vendorId: pausedVendor.id,
        displayName: pausedVendor.displayName,
        stallLocation: pausedVendor.stallLocation,
        operatingStatus: pausedVendor.operatingStatus,
      },
    ]);
  });

  it("re-resolves a selected vendor at the action boundary", async () => {
    const { getById, simulator } = createSimulator(true);

    await expect(
      simulator.resolveSelection(activeCustomerAccount.id, openVendor.id),
    ).resolves.toEqual({
      vendorId: openVendor.id,
      displayName: openVendor.displayName,
      operatingStatus: openVendor.operatingStatus,
    });
    expect(getById).toHaveBeenCalledWith(openVendor.id);
  });
});
