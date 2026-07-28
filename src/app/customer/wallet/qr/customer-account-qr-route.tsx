"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { loadConfiguredCustomerAccountQr } from "@/config/configured-qr-payments";
import { generateTokenlyQrCodeDataUrl } from "@/config/qr-code-image-generator";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { decideRoleAccess } from "@/modules/authentication";
import { CustomerAccountQrScreen } from "@/modules/qr-payments";

export function CustomerAccountQrRoute() {
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

  const loadAccountQr = useCallback(async () => {
    if (actorAccountId === null) {
      throw new Error("The customer session is unavailable.");
    }

    return loadConfiguredCustomerAccountQr(actorAccountId);
  }, [actorAccountId]);

  if (runtime.status === "error") {
    return (
      <section className="mx-auto w-full max-w-xl rounded-card bg-white p-6 text-center shadow-soft">
        <h1 className="text-2xl font-bold text-ink">My account QR</h1>
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
        Preparing your account code…
      </p>
    );
  }

  return (
    <CustomerAccountQrScreen
      generateQrImage={generateTokenlyQrCodeDataUrl}
      loadAccountQr={loadAccountQr}
    />
  );
}
