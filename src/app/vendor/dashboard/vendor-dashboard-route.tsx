"use client";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  History,
  LoaderCircle,
  LogOut,
  Minus,
  Plus,
  ScanLine,
  Square,
  WalletCards,
  X,
} from "lucide-react";
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
  readonly reference?: string;
  readonly walletPublicCode: string;
}

interface VendorActivityItem {
  readonly description: string;
  readonly direction: "credit" | "debit";
  readonly entryType: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly reference: string;
  readonly tokenAmount: number;
}

interface VendorOverview {
  readonly balance: number;
  readonly displayName: string;
  readonly recentActivity: readonly VendorActivityItem[];
  readonly stallLocation: string;
}

type ScanState = "idle" | "starting" | "active" | "error";
type ChargeMode = "add" | "deduct";

function parseTokenAmount(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const amount = Number(value);
  return Number.isSafeInteger(amount * 100) && amount > 0 ? amount : null;
}

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

async function updateCustomerWallet(input: {
  readonly customerId: string;
  readonly direction: ChargeMode;
  readonly tokenAmount: number;
}): Promise<ResolvedCustomerWallet> {
  const response = await fetch("/api/vendor/customer-wallet/charge", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json()) as { readonly code?: string };
    throw new Error(body.code ?? "CUSTOMER_WALLET_CHARGE_FAILED");
  }

  return (await response.json()) as ResolvedCustomerWallet;
}

async function loadVendorOverview(): Promise<VendorOverview> {
  const response = await fetch("/api/vendor/overview", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("VENDOR_OVERVIEW_UNAVAILABLE");
  }

  return (await response.json()) as VendorOverview;
}

function formatActivityType(entryType: string): string {
  switch (entryType) {
    case "vendor_receipt":
      return "Deducted";
    case "vendor_refund":
      return "Added back";
    case "vendor_settlement":
      return "Settlement";
    default:
      return "Activity";
  }
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function VendorDashboardRoute() {
  const runtime = useTokenlyRuntime();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<VendorCameraScanSession | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overview, setOverview] = useState<VendorOverview | null>(null);
  const [wallet, setWallet] = useState<ResolvedCustomerWallet | null>(null);
  const [mode, setMode] = useState<ChargeMode | null>(null);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<ResolvedCustomerWallet | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const tokenAmount = parseTokenAmount(amount);
  const showLoadingOverlay =
    isResolving || isSaving || isLoadingOverview || scanState === "starting";

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
    let active = true;

    if (
      runtime.status !== "ready" ||
      runtime.session?.account.role !== "vendor"
    ) {
      return () => {
        active = false;
      };
    }

    void Promise.resolve()
      .then(() => {
        if (active) {
          setIsLoadingOverview(true);
        }
      })
      .then(loadVendorOverview)
      .then((loadedOverview) => {
        if (active) {
          setOverview(loadedOverview);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Vendor balance could not load.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingOverview(false);
        }
      });

    return () => {
      active = false;
    };
  }, [runtime.session?.account.role, runtime.status]);

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
    };
  }, []);

  async function resolveValue(value: string): Promise<void> {
    setMessage(null);
    setReceipt(null);
    setMode(null);
    setIsResolving(true);

    try {
      setWallet(await resolveCustomerWallet(value));
      setAmount("");
      setManualValue("");
    } catch {
      setMessage("Wallet unavailable. Try again.");
    } finally {
      setIsResolving(false);
    }
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
        setMessage("Camera needs HTTPS. Use manual code here.");
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
      setMessage("Camera could not start. Use manual code.");
    }
  }

  async function stopCamera(): Promise<void> {
    await sessionRef.current?.stop();
    sessionRef.current = null;
    setScanState("idle");
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resolveValue(manualValue);
  }

  async function confirmAmount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (wallet === null || mode === null) {
      return;
    }

    if (tokenAmount === null) {
      setMessage("Enter an amount.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const updatedWallet = await updateCustomerWallet({
        customerId: wallet.customerId,
        direction: mode,
        tokenAmount,
      });
      setWallet(updatedWallet);
      setReceipt(updatedWallet);
      setMode(null);
      setAmount("");
      void loadVendorOverview()
        .then(setOverview)
        .catch(() => setMessage("Vendor activity could not refresh."));
    } catch (error: unknown) {
      setMessage(
        error instanceof Error &&
          error.message === "TOKEN_CHARGE_INSUFFICIENT_BALANCE"
          ? "Not enough customer tokens."
          : error instanceof Error &&
              error.message === "TOKEN_RETURN_INSUFFICIENT_VENDOR_BALANCE"
            ? "Not enough vendor tokens."
            : "Could not save. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
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
          Opening...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-5">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
              Vendor
            </p>
            <h1 className="text-3xl font-bold text-ink">Scan wallet</h1>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={signOut}
            className="grid size-11 place-items-center rounded-full bg-white text-ink shadow-soft"
          >
            <LogOut aria-hidden="true" className="size-5" />
          </button>
        </header>

        <section className="mt-5 rounded-card bg-ink p-5 text-white shadow-raised">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/65">
                {overview?.displayName ?? "Vendor wallet"}
              </p>
              <p className="mt-2 text-5xl font-bold tabular-nums">
                {overview?.balance ?? 0}
              </p>
              <p className="text-white/70">tokens</p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
              <WalletCards aria-hidden="true" className="size-6" />
            </span>
          </div>
          {overview?.stallLocation !== undefined && (
            <p className="mt-4 truncate text-sm text-white/60">
              {overview.stallLocation}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-card bg-white p-4 shadow-soft">
          <div
            className={`relative overflow-hidden rounded-3xl bg-ink ${
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
              className="aspect-square min-h-72 w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(10,22,37,0.28)]"
            />
            {scanState === "starting" && (
              <p className="absolute inset-x-4 bottom-4 rounded-full bg-ink/80 px-4 py-2 text-center text-sm font-semibold text-white">
                Starting camera...
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              scanState === "active" ? void stopCamera() : void startCamera()
            }
            disabled={scanState === "starting"}
            className="mt-1 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-3xl bg-ink px-5 text-lg font-bold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
          >
            {scanState === "active" ? (
              <Square aria-hidden="true" className="size-5 fill-current" />
            ) : (
              <Camera aria-hidden="true" className="size-6" />
            )}
            {scanState === "active"
              ? "Stop"
              : scanState === "starting"
                ? "Starting..."
                : "Scan QR"}
          </button>
        </section>

        <form
          className="mt-4 grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(event) => void submitManual(event)}
        >
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Paste wallet code"
            className="min-h-14 rounded-2xl bg-white px-4 font-mono text-sm text-ink shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <button
            type="submit"
            disabled={isResolving}
            className="grid min-h-14 min-w-14 place-items-center rounded-2xl bg-brand-blue-strong text-white shadow-soft disabled:cursor-wait"
            aria-label="Open wallet"
          >
            <ScanLine aria-hidden="true" className="size-5" />
          </button>
        </form>

        {message !== null && (
          <p className="mt-4 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-bold text-danger">
            {message}
          </p>
        )}

        {receipt !== null && (
          <section className="mt-5 rounded-card bg-brand-mint-soft p-5 shadow-soft">
            <p className="flex items-center gap-2 font-bold text-brand-mint-strong">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              Done
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {receipt.displayName}: {receipt.balance} tokens left
            </p>
            <p className="mt-2 font-mono text-xs break-all text-ink-muted">
              {receipt.reference}
            </p>
          </section>
        )}

        <section className="mt-5 rounded-card bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <History aria-hidden="true" className="size-5" />
              Recent
            </h2>
          </div>
          {overview?.recentActivity.length === 0 || overview === null ? (
            <p className="mt-4 text-sm text-ink-muted">
              No vendor changes yet.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-ink/6">
              {overview.recentActivity.map((activity) => {
                const isCredit = activity.direction === "credit";

                return (
                  <li
                    key={activity.id}
                    className="grid grid-cols-[1fr_auto] gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {formatActivityType(activity.entryType)}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {formatTime(activity.occurredAt)} - {activity.reference}
                      </p>
                    </div>
                    <p
                      className={`font-bold tabular-nums ${
                        isCredit ? "text-success" : "text-danger"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {activity.tokenAmount}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {wallet !== null && receipt === null && (
        <div className="fixed inset-0 z-50 grid items-end bg-ink/45 backdrop-blur-sm">
          <section className="rounded-t-[2rem] bg-white p-5 shadow-floating">
            <div className="mx-auto max-w-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-success">
                    Wallet scanned
                  </p>
                  <h2 className="mt-1 text-3xl font-bold text-ink">
                    {wallet.displayName}
                  </h2>
                  <p className="mt-1 text-ink-muted">{wallet.balance} tokens</p>
                </div>
                <button
                  type="button"
                  aria-label="Close wallet"
                  onClick={() => {
                    setWallet(null);
                    setMode(null);
                    setAmount("");
                  }}
                  className="grid size-11 place-items-center rounded-full bg-canvas text-ink"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>

              {mode === null ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("add")}
                    className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-brand-mint-soft text-xl font-bold text-brand-mint-strong"
                  >
                    <Plus aria-hidden="true" className="size-8" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("deduct")}
                    className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-ink text-xl font-bold text-white"
                  >
                    <Minus aria-hidden="true" className="size-8" />
                    Deduct
                  </button>
                </div>
              ) : (
                <form
                  className="mt-6"
                  onSubmit={(event) => void confirmAmount(event)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMode(null);
                      setAmount("");
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted"
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Back
                  </button>
                  <label className="mt-4 block">
                    <span className="text-sm font-bold text-ink">
                      {mode === "add" ? "Add tokens" : "Deduct tokens"}
                    </span>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      className="mt-2 min-h-20 w-full rounded-3xl bg-canvas px-5 text-4xl font-bold text-ink tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="mt-4 min-h-16 w-full rounded-3xl bg-brand-blue-strong px-5 text-lg font-bold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
                  >
                    {isSaving ? "Saving..." : "Confirm"}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {showLoadingOverlay && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/55 backdrop-blur-sm">
          <div className="grid gap-3 rounded-3xl bg-white px-7 py-6 text-center shadow-floating">
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto size-8 animate-spin text-brand-blue-strong"
            />
            <p role="status" className="font-bold text-ink">
              Loading
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
