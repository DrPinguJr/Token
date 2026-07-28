"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { browserVendorCameraScanner } from "@/config/browser-vendor-camera-scanner";
import {
  listConfiguredDevelopmentVendorOptions,
  resolveConfiguredDevelopmentVendorSelection,
  resolveConfiguredManualVendorCode,
  resolveConfiguredScannedVendor,
} from "@/config/configured-qr-payments";
import { areDevelopmentToolsEnabled } from "@/config/development-tools";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { decideRoleAccess } from "@/modules/authentication";
import {
  VendorScanScreen,
  type ResolvedVendorQrTarget,
} from "@/modules/qr-payments";

export function CustomerScanRoute() {
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const accessDecision =
    runtime.status === "ready"
      ? decideRoleAccess(runtime.session, ["customer"])
      : null;
  const allowedSession =
    accessDecision?.status === "allowed" ? accessDecision.session : null;
  const redirectDestination =
    accessDecision?.status === "redirect"
      ? accessDecision.destination
      : allowedSession?.destination === "/customer/onboarding"
        ? allowedSession.destination
        : null;
  const actorAccountId = allowedSession?.account.id ?? null;

  useEffect(() => {
    if (redirectDestination !== null) {
      router.replace(redirectDestination);
    }
  }, [redirectDestination, router]);

  const requireActorAccountId = useCallback((): string => {
    if (actorAccountId === null) {
      throw new Error("The customer session is unavailable.");
    }

    return actorAccountId;
  }, [actorAccountId]);

  const resolveScannedVendor = useCallback(
    (payload: string): Promise<ResolvedVendorQrTarget> =>
      resolveConfiguredScannedVendor(requireActorAccountId(), payload),
    [requireActorAccountId],
  );
  const resolveManualVendor = useCallback(
    (publicCode: string): Promise<ResolvedVendorQrTarget> =>
      resolveConfiguredManualVendorCode(requireActorAccountId(), publicCode),
    [requireActorAccountId],
  );
  const listDevelopmentVendors = useCallback(
    () => listConfiguredDevelopmentVendorOptions(requireActorAccountId()),
    [requireActorAccountId],
  );
  const resolveDevelopmentVendor = useCallback(
    (vendorId: string): Promise<ResolvedVendorQrTarget> =>
      resolveConfiguredDevelopmentVendorSelection(
        requireActorAccountId(),
        vendorId,
      ),
    [requireActorAccountId],
  );
  const openVendor = useCallback(
    (vendorId: string): void => {
      router.push(`/customer/vendors/${encodeURIComponent(vendorId)}`);
    },
    [router],
  );

  if (runtime.status === "error") {
    return (
      <section className="mx-auto w-full max-w-xl rounded-card bg-white p-6 text-center shadow-soft">
        <h1 className="text-2xl font-bold text-ink">Find a vendor</h1>
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-brand-pink-soft px-4 py-3 font-medium text-danger"
        >
          Tokenly local data did not open. Try opening it again.
        </p>
        <button
          type="button"
          onClick={() => void runtime.reloadRuntime().catch(() => undefined)}
          className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          Try again
        </button>
      </section>
    );
  }

  if (
    runtime.status === "loading" ||
    accessDecision === null ||
    redirectDestination !== null ||
    actorAccountId === null
  ) {
    return (
      <p
        role="status"
        className="mx-auto w-fit rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
      >
        Preparing vendor scan…
      </p>
    );
  }

  return (
    <VendorScanScreen
      cameraAdapter={browserVendorCameraScanner}
      developmentToolsEnabled={areDevelopmentToolsEnabled()}
      listDevelopmentVendors={listDevelopmentVendors}
      onVendorResolved={openVendor}
      resolveDevelopmentVendor={resolveDevelopmentVendor}
      resolveManualVendor={resolveManualVendor}
      resolveScannedVendor={resolveScannedVendor}
    />
  );
}
