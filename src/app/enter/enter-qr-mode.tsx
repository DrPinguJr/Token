"use client";

import { ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { browserVendorCameraScanner } from "@/config/browser-vendor-camera-scanner";
import type { VendorCameraScanSession } from "@/modules/qr-payments";

type QrModeState = "active" | "closed" | "error" | "starting";

export function parseTokenlyAccessQrPath(
  payload: string,
  expectedOrigin: string,
): string | null {
  const value = payload.trim();
  if (value.length === 0 || value.length > 500 || value.startsWith("//")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value, expectedOrigin);
  } catch {
    return null;
  }

  if (
    url.origin !== expectedOrigin ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return null;
  }

  return /^\/(?:claim|card)\/[A-Za-z0-9_-]+$/.test(url.pathname)
    ? url.pathname
    : null;
}

export function EnterQrMode() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<VendorCameraScanSession | null>(null);
  const handlingRef = useRef(false);
  const [state, setState] = useState<QrModeState>("closed");

  useEffect(
    () => () => {
      void sessionRef.current?.stop();
      sessionRef.current = null;
    },
    [],
  );

  async function close(): Promise<void> {
    await sessionRef.current?.stop();
    sessionRef.current = null;
    handlingRef.current = false;
    setState("closed");
  }

  async function start(): Promise<void> {
    const video = videoRef.current;
    if (video === null) {
      setState("error");
      return;
    }

    setState("starting");
    handlingRef.current = false;
    await sessionRef.current?.stop();
    sessionRef.current = null;

    try {
      if (!(await browserVendorCameraScanner.checkSupport())) {
        setState("error");
        return;
      }

      sessionRef.current = await browserVendorCameraScanner.start(
        video,
        async (payload) => {
          if (handlingRef.current) {
            return "invalid";
          }

          const path = parseTokenlyAccessQrPath(
            payload,
            window.location.origin,
          );
          if (path === null) {
            handlingRef.current = true;
            await sessionRef.current?.stop();
            sessionRef.current = null;
            setState("error");
            handlingRef.current = false;
            return "invalid";
          }

          handlingRef.current = true;
          await sessionRef.current?.stop();
          sessionRef.current = null;
          router.push(path);
          return "accepted";
        },
      );
      setState("active");
    } catch {
      sessionRef.current = null;
      setState("error");
    }
  }

  const cameraIsVisible = state === "starting" || state === "active";

  return (
    <section aria-labelledby="qr-mode-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="qr-mode-heading" className="font-bold text-ink">
            QR mode
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Scan your Tokenly access QR.
          </p>
        </div>
        {state === "closed" || state === "error" ? (
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-blue-soft px-4 py-2 font-semibold text-brand-blue-strong"
          >
            <ScanLine aria-hidden="true" className="size-5" />
            Scan QR
          </button>
        ) : (
          <button
            type="button"
            aria-label="Close QR mode"
            onClick={() => void close()}
            className="grid size-11 place-items-center rounded-full bg-canvas text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <div
        className={`relative mt-4 overflow-hidden rounded-3xl bg-ink ${
          cameraIsVisible ? "block" : "hidden"
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Tokenly access QR camera preview"
          className="aspect-square min-h-64 w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[14%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(10,22,37,0.3)]"
        />
        <p className="absolute inset-x-4 bottom-4 rounded-full bg-ink/80 px-4 py-2 text-center text-sm font-semibold text-white">
          {state === "starting" ? "Starting camera..." : "Scan access QR"}
        </p>
      </div>

      {state === "error" && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          QR could not be read. Try a refreshed claim QR.
        </p>
      )}
    </section>
  );
}
