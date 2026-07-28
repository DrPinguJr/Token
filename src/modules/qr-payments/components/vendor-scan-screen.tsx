"use client";

import {
  ArrowRight,
  Code2,
  FlaskConical,
  Keyboard,
  LoaderCircle,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import type { DevelopmentVendorOption } from "../development-vendor-simulator";
import type {
  VendorCameraPayloadOutcome,
  VendorCameraScannerAdapter,
} from "../vendor-camera-scanner";
import {
  VendorQrResolutionError,
  type ResolvedVendorQrTarget,
} from "../vendor-qr-resolution";
import { VendorCameraScanner } from "./vendor-camera-scanner";

export interface VendorScanScreenProps {
  readonly cameraAdapter: VendorCameraScannerAdapter;
  readonly developmentToolsEnabled: boolean;
  readonly listDevelopmentVendors: () => Promise<
    readonly DevelopmentVendorOption[]
  >;
  readonly onVendorResolved: (vendorId: string) => void;
  readonly resolveDevelopmentVendor: (
    vendorId: string,
  ) => Promise<ResolvedVendorQrTarget>;
  readonly resolveManualVendor: (
    publicCode: string,
  ) => Promise<ResolvedVendorQrTarget>;
  readonly resolveScannedVendor: (
    payload: string,
  ) => Promise<ResolvedVendorQrTarget>;
}

type DevelopmentOptionsState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly options: readonly DevelopmentVendorOption[];
      readonly status: "ready";
    }
  | { readonly status: "error" };

function getManualResolutionMessage(error: unknown): string {
  if (error instanceof VendorQrResolutionError) {
    return error.code === "VENDOR_CODE_NOT_FOUND"
      ? "No vendor in this event matches that code."
      : "Enter a Tokenly vendor code beginning with vnd_.";
  }

  return "Vendor lookup is unavailable right now. Try again.";
}

export function VendorScanScreen({
  cameraAdapter,
  developmentToolsEnabled,
  listDevelopmentVendors,
  onVendorResolved,
  resolveDevelopmentVendor,
  resolveManualVendor,
  resolveScannedVendor,
}: VendorScanScreenProps) {
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isResolvingManual, setIsResolvingManual] = useState(false);
  const [developmentState, setDevelopmentState] =
    useState<DevelopmentOptionsState>({ status: "idle" });
  const [selectedDevelopmentVendorId, setSelectedDevelopmentVendorId] =
    useState("");
  const [developmentError, setDevelopmentError] = useState<string | null>(null);
  const [isResolvingDevelopment, setIsResolvingDevelopment] = useState(false);

  async function resolveCameraPayload(
    payload: string,
  ): Promise<VendorCameraPayloadOutcome> {
    try {
      const vendor = await resolveScannedVendor(payload);
      onVendorResolved(vendor.vendorId);
      return "accepted";
    } catch (error: unknown) {
      if (error instanceof VendorQrResolutionError) {
        return "invalid";
      }

      throw error;
    }
  }

  async function submitManualCode(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setManualError(null);
    setIsResolvingManual(true);

    try {
      const vendor = await resolveManualVendor(manualCode);
      onVendorResolved(vendor.vendorId);
    } catch (error: unknown) {
      setManualError(getManualResolutionMessage(error));
    } finally {
      setIsResolvingManual(false);
    }
  }

  async function loadDevelopmentOptions(): Promise<void> {
    setDevelopmentError(null);
    setDevelopmentState({ status: "loading" });

    try {
      const options = await listDevelopmentVendors();
      setDevelopmentState({ status: "ready", options });
      setSelectedDevelopmentVendorId(options[0]?.vendorId ?? "");
    } catch {
      setDevelopmentState({ status: "error" });
    }
  }

  async function openDevelopmentVendor(): Promise<void> {
    if (selectedDevelopmentVendorId === "") {
      setDevelopmentError("Choose a seeded vendor first.");
      return;
    }

    setDevelopmentError(null);
    setIsResolvingDevelopment(true);

    try {
      const vendor = await resolveDevelopmentVendor(
        selectedDevelopmentVendorId,
      );
      onVendorResolved(vendor.vendorId);
    } catch {
      setDevelopmentError(
        "The development vendor could not be opened. Reload the choices and try again.",
      );
    } finally {
      setIsResolvingDevelopment(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue-strong uppercase">
          Start a purchase
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
          Find a vendor
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
          Scan the vendor’s Tokenly QR or enter the opaque vendor code printed
          beside it. You will review the vendor before choosing products.
        </p>
      </header>

      <VendorCameraScanner
        adapter={cameraAdapter}
        onPayload={resolveCameraPayload}
      />

      <section
        aria-labelledby="manual-vendor-heading"
        className="rounded-card bg-white p-5 shadow-soft sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-mint-soft text-brand-mint-strong">
            <Keyboard aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2
              id="manual-vendor-heading"
              className="text-lg font-bold text-ink"
            >
              Enter vendor code
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Use this fallback if camera access is unavailable or declined.
            </p>
          </div>
        </div>

        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => void submitManualCode(event)}
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="manual-vendor-code"
              className="text-sm font-semibold text-ink"
            >
              Tokenly vendor code
            </label>
            <div className="relative mt-2">
              <Code2
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="manual-vendor-code"
                name="vendorCode"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="vnd_8K2M4Q7P"
                aria-describedby={
                  manualError === null
                    ? "vendor-code-hint"
                    : "vendor-code-error"
                }
                className="min-h-12 w-full rounded-2xl border border-ink/15 bg-canvas px-4 py-3 pl-11 font-mono text-base text-ink transition outline-none placeholder:text-ink-muted/65 focus:border-brand-blue-strong focus:ring-3 focus:ring-brand-blue/35"
              />
            </div>
            {manualError === null ? (
              <p id="vendor-code-hint" className="mt-2 text-xs text-ink-muted">
                Vendor codes begin with vnd_ and contain no payment details.
              </p>
            ) : (
              <p
                id="vendor-code-error"
                role="alert"
                className="mt-2 text-sm font-medium text-danger"
              >
                {manualError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isResolvingManual}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResolvingManual ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <ArrowRight aria-hidden="true" className="size-5" />
            )}
            {isResolvingManual ? "Checking…" : "Open vendor"}
          </button>
        </form>
      </section>

      {developmentToolsEnabled && (
        <section
          aria-labelledby="development-vendor-heading"
          className="rounded-card border border-dashed border-brand-pink-strong/35 bg-brand-pink-soft/55 p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-pink-strong shadow-soft">
              <FlaskConical aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-brand-pink-strong uppercase">
                Development simulator
              </p>
              <h2
                id="development-vendor-heading"
                className="mt-1 text-lg font-bold text-ink"
              >
                Open a seeded vendor
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                This local-only shortcut simulates a successful vendor scan.
              </p>
            </div>
          </div>

          {developmentState.status === "idle" && (
            <button
              type="button"
              onClick={() => void loadDevelopmentOptions()}
              className="mt-5 min-h-11 rounded-full border border-ink/15 bg-white px-5 py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
            >
              Load seeded vendors
            </button>
          )}

          {developmentState.status === "loading" && (
            <p role="status" className="mt-5 font-medium text-ink-muted">
              Loading development choices…
            </p>
          )}

          {developmentState.status === "error" && (
            <div className="mt-5">
              <p role="alert" className="font-medium text-danger">
                Development choices are unavailable.
              </p>
              <button
                type="button"
                onClick={() => void loadDevelopmentOptions()}
                className="mt-3 min-h-11 rounded-full border border-ink/15 bg-white px-5 py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
              >
                Try again
              </button>
            </div>
          )}

          {developmentState.status === "ready" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label
                  htmlFor="development-vendor"
                  className="text-sm font-semibold text-ink"
                >
                  Seeded vendor
                </label>
                <select
                  id="development-vendor"
                  value={selectedDevelopmentVendorId}
                  onChange={(event) =>
                    setSelectedDevelopmentVendorId(event.target.value)
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-ink outline-none focus:border-brand-pink-strong focus:ring-3 focus:ring-brand-pink/35"
                >
                  {developmentState.options.map((option) => (
                    <option key={option.vendorId} value={option.vendorId}>
                      {option.displayName} · {option.stallLocation} ·{" "}
                      {option.operatingStatus}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={isResolvingDevelopment}
                onClick={() => void openDevelopmentVendor()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolvingDevelopment ? "Opening…" : "Open simulated scan"}
              </button>
            </div>
          )}

          {developmentError !== null && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {developmentError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
