import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { VendorCameraScannerAdapter } from "../vendor-camera-scanner";
import { VendorQrResolutionError } from "../vendor-qr-resolution";
import { VendorScanScreen } from "./vendor-scan-screen";

const unsupportedCamera: VendorCameraScannerAdapter = {
  checkSupport: vi.fn(async () => false),
  start: vi.fn(async () => ({ stop: vi.fn() })),
};

const resolvedVendor = Object.freeze({
  vendorId: "vendor-001",
  displayName: "Courtside Kitchen",
  operatingStatus: "open" as const,
});

function renderScreen(
  options: Readonly<{
    developmentToolsEnabled?: boolean;
    resolveManualVendor?: (
      publicCode: string,
    ) => Promise<typeof resolvedVendor>;
  }> = {},
) {
  const onVendorResolved = vi.fn();
  const resolveManualVendor =
    options.resolveManualVendor ?? vi.fn(async () => resolvedVendor);
  const listDevelopmentVendors = vi.fn(async () => [
    {
      vendorId: resolvedVendor.vendorId,
      displayName: resolvedVendor.displayName,
      stallLocation: "Hall A · Stall 03",
      operatingStatus: "open" as const,
    },
  ]);
  const resolveDevelopmentVendor = vi.fn(async () => resolvedVendor);

  render(
    <VendorScanScreen
      cameraAdapter={unsupportedCamera}
      developmentToolsEnabled={options.developmentToolsEnabled ?? false}
      listDevelopmentVendors={listDevelopmentVendors}
      onVendorResolved={onVendorResolved}
      resolveDevelopmentVendor={resolveDevelopmentVendor}
      resolveManualVendor={resolveManualVendor}
      resolveScannedVendor={vi.fn(async () => resolvedVendor)}
    />,
  );

  return {
    listDevelopmentVendors,
    onVendorResolved,
    resolveDevelopmentVendor,
    resolveManualVendor,
  };
}

describe("VendorScanScreen", () => {
  it("resolves manual vendor entry and forwards the opaque vendor id", async () => {
    const user = userEvent.setup();
    const { onVendorResolved, resolveManualVendor } = renderScreen();

    await user.type(
      screen.getByRole("textbox", { name: "Tokenly vendor code" }),
      "vnd_8K2M4Q7P",
    );
    await user.click(screen.getByRole("button", { name: "Open vendor" }));

    await waitFor(() => {
      expect(resolveManualVendor).toHaveBeenCalledWith("vnd_8K2M4Q7P");
      expect(onVendorResolved).toHaveBeenCalledWith("vendor-001");
    });
  });

  it("maps lookup errors to safe, actionable manual-entry copy", async () => {
    const user = userEvent.setup();
    renderScreen({
      resolveManualVendor: vi.fn(async () => {
        throw new VendorQrResolutionError("VENDOR_CODE_NOT_FOUND");
      }),
    });

    await user.type(
      screen.getByRole("textbox", { name: "Tokenly vendor code" }),
      "vnd_9Z9Z9Z9Z",
    );
    await user.click(screen.getByRole("button", { name: "Open vendor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no vendor in this event matches that code/i,
    );
  });

  it("hides the development simulator unless the exact feature gate is enabled", () => {
    renderScreen({ developmentToolsEnabled: false });

    expect(
      screen.queryByText("Development simulator"),
    ).not.toBeInTheDocument();
  });

  it("re-resolves a development selection at the action boundary", async () => {
    const user = userEvent.setup();
    const {
      listDevelopmentVendors,
      onVendorResolved,
      resolveDevelopmentVendor,
    } = renderScreen({ developmentToolsEnabled: true });

    await user.click(
      screen.getByRole("button", { name: "Load seeded vendors" }),
    );
    expect(
      await screen.findByRole("option", { name: /Courtside Kitchen/i }),
    ).toBeVisible();
    expect(listDevelopmentVendors).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole("button", { name: "Open simulated scan" }),
    );

    await waitFor(() => {
      expect(resolveDevelopmentVendor).toHaveBeenCalledWith("vendor-001");
      expect(onVendorResolved).toHaveBeenCalledWith("vendor-001");
    });
  });
});
