"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CircleAlert,
  CircleDotDashed,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  ACCOUNT_ENTRY_FAILURE_MESSAGE,
  AccountEntryFailedError,
} from "../account-entry-service";
import {
  accountEntrySchema,
  type AccountEntryFormInput,
  type AccountEntryInput,
} from "../mobile-account-entry-schema";

export const ACCOUNT_ENTRY_RECOVERY_MESSAGE =
  "Tokenly could not complete account entry right now. Try again or visit event help.";

export interface AccountEntryScreenProps {
  readonly runtimeStatus: "error" | "loading" | "ready";
  readonly runtimeErrorMessage: string | null;
  readonly onEnter: (input: AccountEntryInput) => Promise<void>;
  readonly onRetry: () => Promise<void>;
}

export function AccountEntryScreen({
  runtimeStatus,
  runtimeErrorMessage,
  onEnter,
  onRetry,
}: AccountEntryScreenProps) {
  const [entryErrorKind, setEntryErrorKind] = useState<
    "account" | "runtime" | null
  >(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setFocus,
    setValue,
  } = useForm<AccountEntryFormInput, unknown, AccountEntryInput>({
    resolver: zodResolver(accountEntrySchema),
    defaultValues: {
      mobileNumber: "",
    },
  });

  const mobileNumberRegistration = register("mobileNumber", {
    onChange: () => {
      clearErrors("root");
      setEntryErrorKind(null);
    },
  });
  const isBusy = isSubmitting || runtimeStatus === "loading";

  const submitEntry = handleSubmit(async (input) => {
    clearErrors("root");
    setEntryErrorKind(null);

    try {
      await onEnter(input);
    } catch (error: unknown) {
      const isAccountFailure = error instanceof AccountEntryFailedError;
      setEntryErrorKind(isAccountFailure ? "account" : "runtime");
      setError("root", {
        type: isAccountFailure ? "account-entry" : "runtime",
        message: isAccountFailure
          ? ACCOUNT_ENTRY_FAILURE_MESSAGE
          : ACCOUNT_ENTRY_RECOVERY_MESSAGE,
      });
      setFocus("mobileNumber");
    }
  });

  const retryRuntime = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // The stable runtime message remains visible; internal storage details do
      // not belong in the account-entry UI.
    } finally {
      setIsRetrying(false);
    }
  };

  const useCustomerExample = (): void => {
    setValue("mobileNumber", "9000 0009", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors("root");
    setEntryErrorKind(null);
    setFocus("mobileNumber");
  };

  return (
    <section className="grid items-center gap-8 py-7 sm:py-12 lg:min-h-[calc(100vh-10rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.78fr)] lg:gap-16 lg:py-16">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/78 px-3.5 py-2 text-sm font-semibold text-ink-muted shadow-soft ring-1 ring-ink/5 backdrop-blur">
          <CircleDotDashed
            aria-hidden="true"
            className="size-4 text-brand-pink-strong"
          />
          Local event access
        </div>

        <h1 className="mt-5 text-4xl leading-[1.06] font-bold tracking-[-0.045em] text-balance text-ink sm:text-5xl lg:text-6xl">
          Welcome to Tokenly.
          <span className="mt-1 block text-brand-blue-strong">
            Let&apos;s find your wallet.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-pretty text-ink-muted">
          Enter the mobile number assigned to your fictional event account.
          We&apos;ll take you straight to the right local experience.
        </p>

        <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="rounded-card bg-white/70 p-4 shadow-soft ring-1 ring-white/90 backdrop-blur">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
              <WalletCards aria-hidden="true" className="size-5.5" />
            </span>
            <p className="mt-4 font-bold text-ink">One local wallet</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Your role and next screen come from seeded browser data.
            </p>
          </div>
          <div className="rounded-card bg-white/70 p-4 shadow-soft ring-1 ring-white/90 backdrop-blur">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-mint-soft text-brand-mint-strong">
              <ShieldCheck aria-hidden="true" className="size-5.5" />
            </span>
            <p className="mt-4 font-bold text-ink">Prototype only</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              No SMS, identity check, or external account is involved.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-lg">
        <div
          aria-hidden="true"
          className="absolute -top-6 -right-5 size-24 rounded-full bg-brand-pink-soft blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-7 -left-6 size-28 rounded-full bg-brand-blue-soft blur-2xl"
        />

        <div className="tokenly-court-lines relative overflow-hidden rounded-[2rem] bg-white/90 p-5 shadow-floating ring-1 ring-white sm:p-7">
          <div className="relative">
            <span className="grid size-12 place-items-center rounded-2xl bg-ink text-white shadow-raised">
              <Smartphone aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-ink">
              Enter your account
            </h2>
            <p className="mt-2 leading-7 text-ink-muted">
              Use a seeded mobile number. Formatting spaces are welcome.
            </p>

            <div
              role="note"
              className="mt-5 flex gap-3 rounded-2xl bg-brand-pink-soft p-4 text-sm leading-6 text-ink-soft"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-brand-pink-strong"
              />
              <p>
                <span className="font-bold text-ink">
                  Mobile numbers are not verified.
                </span>{" "}
                This local prototype only matches fictional data stored in this
                browser. No SMS will be sent.
              </p>
            </div>

            {runtimeStatus === "error" ? (
              <div role="alert" className="mt-6 rounded-2xl bg-canvas-soft p-4">
                <p className="font-semibold text-ink">
                  Local data did not open
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  {runtimeErrorMessage ??
                    "Tokenly local data is unavailable. Try opening it again."}
                </p>
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() => void retryRuntime()}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-soft ring-1 ring-ink/8 transition hover:bg-brand-blue-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong disabled:cursor-wait disabled:opacity-65"
                >
                  {isRetrying ? "Opening…" : "Try again"}
                </button>
              </div>
            ) : (
              <form
                className="mt-6"
                onSubmit={(event) => void submitEntry(event)}
              >
                <label
                  htmlFor="mobile-number"
                  className="text-sm font-bold text-ink"
                >
                  Mobile number
                </label>
                <div className="relative mt-2">
                  <Smartphone
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    {...mobileNumberRegistration}
                    id="mobile-number"
                    type="tel"
                    inputMode="tel"
                    enterKeyHint="go"
                    autoComplete="tel"
                    placeholder="9000 0001"
                    aria-invalid={
                      errors.mobileNumber === undefined ? undefined : true
                    }
                    aria-describedby="mobile-number-hint mobile-number-error"
                    disabled={isBusy}
                    className="min-h-14 w-full rounded-2xl bg-canvas-soft py-3 pr-4 pl-12 text-lg font-semibold tracking-[0.035em] text-ink ring-1 ring-ink/8 transition outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted/70 hover:ring-ink/18 focus:bg-white focus:ring-2 focus:ring-brand-blue-strong disabled:cursor-wait disabled:opacity-65"
                  />
                </div>
                <p
                  id="mobile-number-hint"
                  className="mt-2 text-sm leading-5 text-ink-muted"
                >
                  Singapore +65 formatting is accepted.
                </p>
                <p
                  id="mobile-number-error"
                  role={errors.mobileNumber === undefined ? undefined : "alert"}
                  className="mt-2 min-h-5 text-sm font-semibold text-danger"
                >
                  {errors.mobileNumber?.message}
                </p>

                {errors.root?.message !== undefined && (
                  <div
                    role="alert"
                    className={`mt-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      entryErrorKind === "runtime"
                        ? "bg-brand-blue-soft text-ink"
                        : "bg-brand-pink-soft text-danger"
                    }`}
                  >
                    <p>{errors.root.message}</p>
                    {entryErrorKind === "runtime" && (
                      <button
                        type="button"
                        disabled={isRetrying}
                        onClick={() => void retryRuntime()}
                        className="mt-2 min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-soft ring-1 ring-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong disabled:cursor-wait disabled:opacity-65"
                      >
                        {isRetrying ? "Openingâ€¦" : "Reopen local data"}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-bold text-white shadow-raised transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong disabled:translate-y-0 disabled:cursor-wait disabled:opacity-65"
                >
                  {isBusy ? (
                    <>
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-5 motion-safe:animate-spin"
                      />
                      Opening Tokenly…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight aria-hidden="true" className="size-5" />
                    </>
                  )}
                </button>

                <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                  <span>Trying the welcome flow?</span>
                  <button
                    type="button"
                    onClick={useCustomerExample}
                    className="min-h-11 rounded-xl px-2 font-bold text-brand-blue-strong underline decoration-brand-blue/70 decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong"
                  >
                    Use 9000 0009
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 border-t border-ink/6 pt-5 text-center text-sm text-ink-muted">
              Need a hand?{" "}
              <Link
                href="/help"
                className="inline-flex min-h-11 items-center px-1 font-bold text-ink underline decoration-brand-pink decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong"
              >
                Visit event help
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
