"use client";

import { Camera, Code2, LogOut, ScanLine, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { browserVendorCameraScanner } from "@/config/browser-vendor-camera-scanner";
import { clearPrototypeSession } from "@/config/remote-customer-access-client";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import type { VendorCameraScanSession } from "@/modules/qr-payments";

interface ResolvedCustomerWallet {
  readonly balance: number;
  readonly customerId: string;
  readonly displayName: string;
  readonly walletPublicCode: string;
}

type ScanState = "idle" | "starting" | "active" | "error";

async function resolveCustomerWallet(
  value: string,
): Promise<ResolvedCustomerWallet> {
  const response = await fetch("/api/vendor/customer-wallet/resolve", {
    body: JSON.stringify({ value }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("CUSTOMER_WALLET_QR_UNAVAILABLE");
  }

  return (await response.json()) as ResolvedCustomerWallet;
}

export function VendorDashboardRoute() {
  const runtime = useTokenlyRuntime();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<VendorCameraScanSession | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedWallet, setResolvedWallet] =
    useState<ResolvedCustomerWallet | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (runtime.status === "ready" && runtime.session === null) {
      router.replace("/enter");
    }

    if (
      runtime.status === "ready" &&
      runtime.session !== null &&
      runtime.session.account.role !== "vendor"
    ) {
      router.replace(runtime.session.destination);
    }
  }, [router, runtime]);

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
    };
  }, []);

  async function resolveValue(value: string): Promise<void> {
    setMessage(null);
    setIsResolving(true);

    try {
      setResolvedWallet(await resolveCustomerWallet(value));
    } catch {
      setMessage("That customer wallet QR could not be opened.");
    } finally {
      setIsResolving(false);
    }
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resolveValue(manualValue);
  }

  async function startCamera(): Promise<void> {
    const video = videoRef.current;
    if (video === null) {
      setScanState("error");
      return;
    }

    setScanState("starting");
    setMessage(null);

    try {
      const supported = await browserVendorCameraScanner.checkSupport();
      if (!supported) {
        setScanState("error");
        setMessage("Camera scanning is unavailable here. Use manual entry.");
        return;
      }

      sessionRef.current = await browserVendorCameraScanner.start(
        video,
        async (payload) => {
          await sessionRef.current?.stop();
          sessionRef.current = null;
          setScanState("idle");
          await resolveValue(payload);
          return "accepted";
        },
      );
      setScanState("active");
    } catch {
      setScanState("error");
      setMessage("Camera could not start. Use manual entry instead.");
    }
  }

  async function stopCamera(): Promise<void> {
    await sessionRef.current?.stop();
    sessionRef.current = null;
    setScanState("idle");
  }

  function signOut(): void {
    runtime.signOut();
    void clearPrototypeSession();
    router.replace("/enter");
  }

  if (
    runtime.status !== "ready" ||
    runtime.session?.account.role !== "vendor"
  ) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 shadow-soft"
        >
          Opening vendor...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
              Vendor
            </p>
            <h1 className="mt-1 text-3xl font-bold text-ink">
              Scan customer QR
            </h1>
            <p className="mt-2 leading-7 text-ink-muted">
              Use the customer wallet QR only. Private account links are not
              accepted here.
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-ink shadow-soft"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </header>

        <section className="mt-6 rounded-card bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
              <ScanLine aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Camera scan</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Camera access is requested only when you start scanning.
              </p>
            </div>
          </div>
          <div
            className={`relative mt-5 overflow-hidden rounded-3xl bg-ink ${
              scanState === "starting" || scanState === "active"
                ? "block"
                : "hidden"
            }`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Customer QR camera preview"
              className="aspect-square min-h-72 w-full object-cover sm:aspect-video"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(10,22,37,0.28)]"
            />
            {scanState === "starting" && (
              <p
                role="status"
                className="absolute inset-x-4 bottom-4 rounded-full bg-ink/80 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Starting camera preview...
              </p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {scanState !== "active" ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={scanState === "starting"}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:bg-ink-muted"
              >
                <Camera aria-hidden="true" className="size-5" />
                {scanState === "starting"
                  ? "Starting preview..."
                  : "Start camera"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopCamera()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white"
              >
                <Square aria-hidden="true" className="size-4 fill-current" />
                Stop camera
              </button>
            )}
          </div>
          {scanState === "active" && (
            <p role="status" className="mt-4 font-medium text-ink">
              Live preview is on. Hold the customer QR inside the frame.
            </p>
          )}
        </section>

        <section className="mt-5 rounded-card bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-ink">Manual entry</h2>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => void submitManual(event)}
          >
            <label>
              <span className="text-sm font-semibold text-ink">
                Customer wallet code or QR payload
              </span>
              <span className="relative mt-2 block">
                <Code2
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
                />
                <input
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder="cus_..."
                  className="min-h-12 w-full rounded-2xl bg-canvas py-3 pr-4 pl-12 font-mono text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={isResolving}
              className="min-h-12 self-end rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:bg-ink-muted"
            >
              {isResolving ? "Checking..." : "Open"}
            </button>
          </form>
        </section>

        {message !== null && (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-white p-4 text-danger shadow-soft"
          >
            {message}
          </p>
        )}

        {resolvedWallet !== null && (
          <section className="mt-5 rounded-card bg-ink p-6 text-white shadow-floating">
            <p className="text-sm font-semibold tracking-[0.14em] text-white/70 uppercase">
              Customer wallet
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {resolvedWallet.displayName}
            </h2>
            <p className="mt-5 text-sm text-white/70">Current balance</p>
            <p className="mt-1 text-6xl font-bold tabular-nums">
              {resolvedWallet.balance}
            </p>
            <p className="mt-1 text-white/75">tokens</p>
            <p className="mt-5 font-mono text-sm break-all text-white/70">
              {resolvedWallet.walletPublicCode}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
