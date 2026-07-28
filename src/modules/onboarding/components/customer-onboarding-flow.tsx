"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { OnboardingCompletionMethod } from "../complete-customer-onboarding-schema";
import { CUSTOMER_ONBOARDING_COMPLETION_ERROR_MESSAGE } from "../onboarding-feedback";

interface OnboardingStep {
  readonly description: string;
  readonly eyebrow: string;
  readonly icon: LucideIcon;
  readonly surfaceClassName: string;
  readonly title: string;
}

const onboardingSteps = [
  {
    eyebrow: "A friendly hello",
    title: "Welcome to Tokenly",
    description:
      "Your event wallet keeps every token close, so there’s more time for the floorball and food you came for.",
    icon: Sparkles,
    surfaceClassName: "bg-brand-pink-soft text-brand-pink-strong",
  },
  {
    eyebrow: "Simple event spending",
    title: "Meet event tokens",
    description:
      "Event staff record tokens after manually checking your top-up. Spend them with participating vendors throughout the event.",
    icon: CircleDollarSign,
    surfaceClassName: "bg-brand-blue-soft text-brand-blue-strong",
  },
  {
    eyebrow: "A clear wallet",
    title: "Every token has a story",
    description:
      "Your balance comes from recorded wallet activity. Purchases, top-ups, and refunds stay together in one clear history.",
    icon: WalletCards,
    surfaceClassName: "bg-brand-mint-soft text-brand-mint-strong",
  },
  {
    eyebrow: "All set",
    title: "You’re now a Tokener",
    description:
      "Your wallet is ready. Browse the event, scan when it’s time to pay, and enjoy your order.",
    icon: BadgeCheck,
    surfaceClassName: "bg-brand-pink-soft text-brand-pink-strong",
  },
] as const satisfies readonly [OnboardingStep, ...OnboardingStep[]];

export interface CustomerOnboardingFlowProps {
  readonly developmentSkipEnabled: boolean;
  readonly displayName: string;
  readonly onComplete: (
    completionMethod: OnboardingCompletionMethod,
  ) => Promise<void>;
}

export function CustomerOnboardingFlow({
  developmentSkipEnabled,
  displayName,
  onComplete,
}: CustomerOnboardingFlowProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const headingReference = useRef<HTMLHeadingElement>(null);
  const activeStep = onboardingSteps[activeStepIndex] ?? onboardingSteps[0];
  const isFinalStep = activeStepIndex === onboardingSteps.length - 1;
  const progressPercentage =
    ((activeStepIndex + 1) / onboardingSteps.length) * 100;
  const StepIcon = activeStep.icon;

  useEffect(() => {
    headingReference.current?.focus();
  }, [activeStepIndex]);

  async function complete(
    completionMethod: OnboardingCompletionMethod,
  ): Promise<void> {
    setErrorMessage(null);
    setIsCompleting(true);

    try {
      await onComplete(completionMethod);
    } catch {
      setErrorMessage(CUSTOMER_ONBOARDING_COMPLETION_ERROR_MESSAGE);
      setIsCompleting(false);
    }
  }

  function showPreviousStep(): void {
    setErrorMessage(null);
    setActiveStepIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function showNextStep(): void {
    setErrorMessage(null);
    setActiveStepIndex((currentIndex) =>
      Math.min(onboardingSteps.length - 1, currentIndex + 1),
    );
  }

  function handlePrimaryAction(): void {
    if (isFinalStep) {
      void complete("guided");
      return;
    }

    showNextStep();
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-canvas px-4 py-5 sm:px-6 sm:py-8">
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-16 size-52 rounded-full bg-brand-pink-soft blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -left-20 size-64 rounded-full bg-brand-blue-soft blur-3xl"
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col sm:min-h-[calc(100dvh-4rem)]">
        <header className="flex items-center justify-between gap-4">
          <p className="text-lg font-bold tracking-[-0.035em] text-ink">
            Tokenly
          </p>
          {developmentSkipEnabled && (
            <button
              type="button"
              disabled={isCompleting}
              onClick={() => void complete("development_skip")}
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60"
            >
              Skip tour <span className="hidden sm:inline">(development)</span>
            </button>
          )}
        </header>

        <div className="mx-auto mt-8 w-full max-w-2xl sm:mt-12">
          <div className="flex items-center justify-between gap-4 text-sm">
            <p className="font-semibold text-ink">
              Step {activeStepIndex + 1} of {onboardingSteps.length}
            </p>
            <p className="text-ink-muted">Hi, {displayName}</p>
          </div>
          <div
            aria-label="Onboarding progress"
            aria-valuemax={onboardingSteps.length}
            aria-valuemin={1}
            aria-valuenow={activeStepIndex + 1}
            className="mt-3 h-2 overflow-hidden rounded-full bg-white shadow-soft"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-brand-blue-strong transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <section
          aria-labelledby="onboarding-heading"
          className="tokenly-court-lines relative mx-auto my-6 grid w-full max-w-5xl flex-1 items-center overflow-hidden rounded-[2rem] bg-white/82 p-5 shadow-floating ring-1 ring-white/80 backdrop-blur sm:my-8 sm:p-8 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)] lg:gap-12 lg:p-12"
        >
          <div className="flex items-center justify-center py-5 lg:py-0">
            <div
              className={`grid size-36 place-items-center rounded-[2.25rem] shadow-soft sm:size-44 ${activeStep.surfaceClassName}`}
            >
              <StepIcon
                aria-hidden="true"
                className="size-16 sm:size-20"
                strokeWidth={1.6}
              />
            </div>
          </div>

          <div
            key={activeStep.title}
            className="animate-[tokenly-step-in_180ms_ease-out] text-center motion-reduce:animate-none lg:text-left"
          >
            <p className="text-sm font-semibold tracking-[0.12em] text-brand-blue-strong uppercase">
              {activeStep.eyebrow}
            </p>
            <h1
              ref={headingReference}
              id="onboarding-heading"
              tabIndex={-1}
              className="mt-3 text-3xl leading-[1.08] font-bold tracking-[-0.04em] text-balance text-ink outline-none sm:text-5xl"
            >
              {activeStep.title}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-pretty text-ink-muted sm:text-lg sm:leading-8 lg:mx-0">
              {activeStep.description}
            </p>
          </div>
        </section>

        <div aria-live="polite" className="mx-auto w-full max-w-2xl">
          {errorMessage !== null && (
            <p
              role="alert"
              className="mb-3 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
            >
              {errorMessage}
            </p>
          )}

          <div className="tokenly-safe-bottom flex items-center gap-3">
            <button
              type="button"
              aria-label="Back"
              disabled={activeStepIndex === 0 || isCompleting}
              onClick={showPreviousStep}
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-white px-4 font-semibold text-ink shadow-soft ring-1 ring-ink/8 transition hover:bg-canvas-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
              <span aria-hidden="true" className="hidden sm:inline">
                Back
              </span>
            </button>

            <button
              type="button"
              disabled={isCompleting}
              onClick={handlePrimaryAction}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:translate-y-0 disabled:cursor-wait disabled:opacity-65"
            >
              {isCompleting
                ? "Finishing…"
                : isFinalStep
                  ? "Enter Tokenly"
                  : "Next"}
              {!isCompleting && (
                <ArrowRight aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
