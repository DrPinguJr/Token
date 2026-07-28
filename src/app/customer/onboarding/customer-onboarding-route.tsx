"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createConfiguredCustomerOnboardingService } from "@/config/configured-customer-onboarding-service";
import { areDevelopmentToolsEnabled } from "@/config/development-tools";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { decideRoleAccess } from "@/modules/authentication";
import {
  CustomerOnboardingFlow,
  CUSTOMER_ONBOARDING_LOAD_ERROR_MESSAGE,
  CUSTOMER_ONBOARDING_RETRY_ERROR_MESSAGE,
  type OnboardingCompletionMethod,
} from "@/modules/onboarding";

export function CustomerOnboardingRoute() {
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const onboardingService = useMemo(
    () => createConfiguredCustomerOnboardingService(),
    [],
  );
  const accessDecision =
    runtime.status === "ready"
      ? decideRoleAccess(runtime.session, ["customer"])
      : null;
  const allowedSession =
    accessDecision?.status === "allowed" ? accessDecision.session : null;
  const redirectDestination =
    accessDecision?.status === "redirect"
      ? accessDecision.destination
      : typeof allowedSession?.customer?.onboardingCompletedAt === "string"
        ? allowedSession.destination
        : null;

  useEffect(() => {
    if (redirectDestination !== null) {
      router.replace(redirectDestination);
    }
  }, [redirectDestination, router]);

  async function completeOnboarding(
    completionMethod: OnboardingCompletionMethod,
  ): Promise<void> {
    if (allowedSession === null || allowedSession.customer === null) {
      throw new Error("The customer session is unavailable.");
    }

    await onboardingService.complete({
      actorAccountId: allowedSession.account.id,
      completionMethod,
    });
    await runtime.refreshSession();
    router.replace("/customer");
  }

  async function retryRuntime(): Promise<void> {
    setRetryFailed(false);
    setIsRetrying(true);

    try {
      await runtime.reloadRuntime();
    } catch {
      setRetryFailed(true);
    } finally {
      setIsRetrying(false);
    }
  }

  if (runtime.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-soft">
          <h1 className="text-2xl font-bold text-ink">
            Your welcome could not load
          </h1>
          <p role="alert" className="mt-3 leading-7 text-ink-muted">
            {CUSTOMER_ONBOARDING_LOAD_ERROR_MESSAGE}
          </p>
          {retryFailed && (
            <p
              role="alert"
              className="mt-3 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
            >
              {CUSTOMER_ONBOARDING_RETRY_ERROR_MESSAGE}
            </p>
          )}
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => void retryRuntime()}
            className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            {isRetrying ? "Trying again…" : "Try again"}
          </button>
        </div>
      </main>
    );
  }

  if (
    runtime.status === "loading" ||
    accessDecision === null ||
    redirectDestination !== null
  ) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
        >
          Preparing your welcome…
        </p>
      </main>
    );
  }

  if (
    accessDecision.status !== "allowed" ||
    accessDecision.session.customer === null
  ) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="alert"
          className="rounded-card bg-brand-pink-soft p-6 font-medium text-danger shadow-soft"
        >
          The customer profile required for onboarding is unavailable.
        </p>
      </main>
    );
  }

  return (
    <CustomerOnboardingFlow
      developmentSkipEnabled={areDevelopmentToolsEnabled()}
      displayName={accessDecision.session.account.displayName}
      onComplete={completeOnboarding}
    />
  );
}
