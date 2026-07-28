import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  VendorCameraPayloadOutcome,
  VendorCameraScannerAdapter,
} from "../vendor-camera-scanner";
import { VendorCameraScanner } from "./vendor-camera-scanner";

function createAdapter(
  options: Readonly<{
    supported?: boolean;
    startError?: unknown;
  }> = {},
) {
  let emitPayload:
    | ((payload: string) => Promise<VendorCameraPayloadOutcome>)
    | null = null;
  const stop = vi.fn();
  const adapter: VendorCameraScannerAdapter = {
    checkSupport: vi.fn(async () => options.supported ?? true),
    start: vi.fn(async (_video, onPayload) => {
      if (options.startError !== undefined) {
        throw options.startError;
      }

      emitPayload = onPayload;
      return { stop };
    }),
  };

  return {
    adapter,
    emit: async (payload: string) => {
      if (emitPayload === null) {
        throw new Error("The scanner has not started.");
      }
      return emitPayload(payload);
    },
    stop,
  };
}

describe("VendorCameraScanner", () => {
  it("survives the React StrictMode lifecycle and resolves a scan", async () => {
    const user = userEvent.setup();
    const camera = createAdapter();
    const onPayload = vi.fn(async () => "accepted" as const);

    render(
      <StrictMode>
        <VendorCameraScanner
          adapter={camera.adapter}
          onPayload={onPayload}
        />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "Allow camera" }));
    expect(
      await screen.findByText(/point the camera at a Tokenly vendor QR/i),
    ).toBeVisible();

    await act(async () => {
      await camera.emit("tokenly://qr/v1/vendor/vnd_8K2M4Q7P");
    });

    expect(onPayload).toHaveBeenCalledWith(
      "tokenly://qr/v1/vendor/vnd_8K2M4Q7P",
    );
    expect(camera.stop).toHaveBeenCalledOnce();
  });

  it("shows an explicit unsupported state with manual fallback copy", async () => {
    const user = userEvent.setup();
    const camera = createAdapter({ supported: false });

    render(
      <VendorCameraScanner
        adapter={camera.adapter}
        onPayload={vi.fn(async () => "accepted")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allow camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /camera scanning is not supported/i,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/vendor code below/i);
    expect(camera.adapter.start).not.toHaveBeenCalled();
  });

  it("distinguishes permission denial from a generic scanner error", async () => {
    const user = userEvent.setup();
    const denied = createAdapter({
      startError: new DOMException("private device detail", "NotAllowedError"),
    });

    const { rerender } = render(
      <VendorCameraScanner
        adapter={denied.adapter}
        onPayload={vi.fn(async () => "accepted")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allow camera" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /camera access was denied/i,
    );
    expect(screen.queryByText(/private device detail/i)).not.toBeInTheDocument();

    const failed = createAdapter({
      startError: new Error("camera-device-secret"),
    });
    rerender(
      <VendorCameraScanner
        adapter={failed.adapter}
        onPayload={vi.fn(async () => "accepted")}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Request camera again" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /camera could not start/i,
    );
    expect(screen.queryByText(/camera-device-secret/i)).not.toBeInTheDocument();
  });

  it("stops and offers another attempt for an invalid decoded payload", async () => {
    const user = userEvent.setup();
    const camera = createAdapter();

    render(
      <VendorCameraScanner
        adapter={camera.adapter}
        onPayload={vi.fn(async () => "invalid")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allow camera" }));
    await screen.findByText(/point the camera/i);
    await act(async () => {
      await camera.emit("https://untrusted.example/qr");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not a valid Tokenly vendor QR code/i,
    );
    expect(
      screen.getByRole("button", { name: "Scan another code" }),
    ).toBeVisible();
    expect(camera.stop).toHaveBeenCalledOnce();
  });
});
