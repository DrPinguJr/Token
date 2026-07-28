"use client";

import QrScanner from "qr-scanner";

import type {
  VendorCameraPayloadOutcome,
  VendorCameraScannerAdapter,
  VendorCameraScanSession,
} from "@/modules/qr-payments";

function browserCameraApisAreAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    typeof navigator !== "undefined" &&
    navigator.mediaDevices !== undefined &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export const browserVendorCameraScanner: VendorCameraScannerAdapter =
  Object.freeze({
    async checkSupport(): Promise<boolean> {
      if (!browserCameraApisAreAvailable()) {
        return false;
      }

      return QrScanner.hasCamera();
    },

    async start(
      video: HTMLVideoElement,
      onPayload: (payload: string) => Promise<VendorCameraPayloadOutcome>,
    ): Promise<VendorCameraScanSession> {
      if (!browserCameraApisAreAvailable()) {
        throw new DOMException(
          "Camera scanning requires a secure browser context.",
          "SecurityError",
        );
      }

      const scanner = new QrScanner(
        video,
        (result) => {
          void onPayload(result.data);
        },
        {
          preferredCamera: "environment",
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );

      try {
        await scanner.start();
      } catch (error: unknown) {
        scanner.destroy();
        throw error;
      }

      let stopped = false;
      return Object.freeze({
        stop(): void {
          if (stopped) {
            return;
          }

          stopped = true;
          scanner.stop();
          scanner.destroy();
        },
      });
    },
  });
