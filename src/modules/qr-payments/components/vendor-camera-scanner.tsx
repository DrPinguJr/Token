"use client";

import { Camera, CameraOff, RefreshCw, ScanLine, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  VendorCameraPayloadOutcome,
  VendorCameraScannerAdapter,
  VendorCameraScanSession,
} from "../vendor-camera-scanner";

type CameraState =
  | "active"
  | "denied"
  | "error"
  | "invalid"
  | "processing"
  | "request"
  | "requesting"
  | "unsupported";

export interface VendorCameraScannerProps {
  readonly adapter: VendorCameraScannerAdapter;
  readonly onPayload: (payload: string) => Promise<VendorCameraPayloadOutcome>;
}

function isCameraPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

export function VendorCameraScanner({
  adapter,
  onPayload,
}: VendorCameraScannerProps) {
  const [cameraState, setCameraState] = useState<CameraState>("request");
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<VendorCameraScanSession | null>(null);
  const isHandlingPayloadRef = useRef(false);
  const isMountedRef = useRef(true);

  const stopSession = useCallback(async (): Promise<void> => {
    const session = sessionRef.current;
    sessionRef.current = null;
    await session?.stop();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      void stopSession();
    };
  }, [stopSession]);

  const handlePayload = useCallback(
    async (payload: string): Promise<VendorCameraPayloadOutcome> => {
      if (isHandlingPayloadRef.current) {
        return "invalid";
      }

      isHandlingPayloadRef.current = true;
      setCameraState("processing");

      try {
        const outcome = await onPayload(payload);
        await stopSession();

        if (isMountedRef.current && outcome === "invalid") {
          setCameraState("invalid");
          isHandlingPayloadRef.current = false;
        }

        return outcome;
      } catch {
        await stopSession();

        if (isMountedRef.current) {
          setCameraState("error");
          isHandlingPayloadRef.current = false;
        }

        return "invalid";
      }
    },
    [onPayload, stopSession],
  );

  const requestCamera = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (video === null) {
      setCameraState("error");
      return;
    }

    setCameraState("requesting");
    isHandlingPayloadRef.current = false;
    await stopSession();

    try {
      const isSupported = await adapter.checkSupport();
      if (!isSupported) {
        setCameraState("unsupported");
        return;
      }

      const session = await adapter.start(video, handlePayload);

      if (!isMountedRef.current) {
        await session.stop();
        return;
      }

      sessionRef.current = session;
      setCameraState("active");
    } catch (error: unknown) {
      setCameraState(isCameraPermissionDenied(error) ? "denied" : "error");
    }
  }, [adapter, handlePayload, stopSession]);

  async function stopCamera(): Promise<void> {
    await stopSession();
    isHandlingPayloadRef.current = false;
    setCameraState("request");
  }

  const cameraIsVisible =
    cameraState === "requesting" ||
    cameraState === "active" ||
    cameraState === "processing";

  return (
    <section
      aria-labelledby="camera-scanner-heading"
      className="rounded-card border border-brand-blue/70 bg-brand-blue-soft/70 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-blue-strong shadow-soft">
          <ScanLine aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            id="camera-scanner-heading"
            className="text-lg font-bold text-ink"
          >
            Scan vendor QR
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Camera frames stay in your browser and are not saved or uploaded.
          </p>
        </div>
      </div>

      <div
        className={`mt-5 overflow-hidden rounded-3xl bg-ink ${
          cameraIsVisible ? "block" : "hidden"
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Vendor QR camera preview"
          className="aspect-square min-h-72 w-full object-cover sm:aspect-video"
        />
      </div>

      {cameraState === "request" && (
        <div className="mt-5">
          <p className="text-sm leading-6 text-ink-muted">
            Camera access is requested only after you choose to allow it.
          </p>
          <button
            type="button"
            onClick={() => void requestCamera()}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus sm:w-auto"
          >
            <Camera aria-hidden="true" className="size-5" />
            Allow camera
          </button>
        </div>
      )}

      {cameraState === "requesting" && (
        <p role="status" className="mt-5 font-medium text-ink-muted">
          Requesting camera access…
        </p>
      )}

      {cameraState === "active" && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="font-medium text-ink">
            Point the camera at a Tokenly vendor QR code.
          </p>
          <button
            type="button"
            onClick={() => void stopCamera()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            <Square aria-hidden="true" className="size-4 fill-current" />
            Stop camera
          </button>
        </div>
      )}

      {cameraState === "processing" && (
        <p role="status" className="mt-4 font-medium text-ink">
          Checking that vendor…
        </p>
      )}

      {cameraState === "denied" && (
        <CameraFeedback
          message="Camera access was denied. Update this site’s camera permission or use the vendor code below."
          retryLabel="Request camera again"
          onRetry={requestCamera}
        />
      )}

      {cameraState === "unsupported" && (
        <CameraFeedback
          message="Camera scanning is not supported here. Use the vendor code below instead."
          retryLabel="Check camera again"
          onRetry={requestCamera}
        />
      )}

      {cameraState === "invalid" && (
        <CameraFeedback
          message="That is not a valid Tokenly vendor QR code. Try another code or enter it manually."
          retryLabel="Scan another code"
          onRetry={requestCamera}
        />
      )}

      {cameraState === "error" && (
        <CameraFeedback
          message="The camera could not start or the code could not be checked. You can try again or use manual entry."
          retryLabel="Try camera again"
          onRetry={requestCamera}
        />
      )}
    </section>
  );
}

interface CameraFeedbackProps {
  readonly message: string;
  readonly onRetry: () => Promise<void>;
  readonly retryLabel: string;
}

function CameraFeedback({ message, onRetry, retryLabel }: CameraFeedbackProps) {
  return (
    <div className="mt-5">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 font-medium text-ink"
      >
        <CameraOff
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-danger"
        />
        {message}
      </p>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {retryLabel}
      </button>
    </div>
  );
}
