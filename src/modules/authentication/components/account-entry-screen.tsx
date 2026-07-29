"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
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
  "Tokenly could not complete account entry right now. Try again.";

export interface AccountEntryScreenProps {
  readonly runtimeStatus: "error" | "loading" | "ready";
  readonly runtimeErrorMessage: string | null;
  readonly onEnter: (input: AccountEntryInput) => Promise<void>;
  readonly onRetry: () => Promise<void>;
  readonly qrMode?: ReactNode;
}

const bigBlueOfficialSite = "https://www.bigbluesports.com.sg/";
const bigBlueCourtImage = "/brand/big-blue-floorball-hero.png";
const bigBlueTokenBoothImage = "/brand/big-blue-token-booth.png";

export function AccountEntryScreen({
  runtimeStatus,
  runtimeErrorMessage,
  onEnter,
  onRetry,
  qrMode,
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
  } = useForm<AccountEntryFormInput, unknown, AccountEntryInput>({
    resolver: zodResolver(accountEntrySchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const usernameRegistration = register("username", {
    onChange: () => {
      clearErrors("root");
      setEntryErrorKind(null);
    },
  });
  const passwordRegistration = register("password", {
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
      setFocus("username");
    }
  });

  async function retryRuntime(): Promise<void> {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // Stable, privacy-safe recovery copy remains visible.
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-2">
      <section className="relative min-h-72 overflow-hidden bg-[#075ca8] lg:min-h-dvh">
        <Image
          src={bigBlueCourtImage}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,92,168,0.1),rgba(10,22,37,0.18)_42%,rgba(10,22,37,0.84))]"
        />
        <div
          aria-hidden="true"
          className="absolute top-5 right-5 hidden aspect-[4/3] w-36 overflow-hidden rounded-lg border border-white/45 bg-white/20 p-1 shadow-raised sm:block lg:top-8 lg:right-8 lg:w-52"
        >
          <div className="relative size-full overflow-hidden rounded-md">
            <Image
              src={bigBlueTokenBoothImage}
              alt=""
              fill
              sizes="(min-width: 1024px) 13rem, 9rem"
              className="object-cover"
            />
          </div>
        </div>
        <div className="relative flex min-h-72 items-end p-7 sm:p-10 lg:min-h-dvh lg:p-14">
          <a
            href={bigBlueOfficialSite}
            target="_blank"
            rel="noreferrer"
            className="text-3xl leading-tight font-bold tracking-[-0.04em] text-white focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-4xl lg:text-5xl"
          >
            Tokenly <span className="text-brand-pink">x</span>{" "}
            <span className="block">Big Blue Floorball</span>
          </a>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:min-h-dvh lg:px-16">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-ink sm:text-4xl">
            Log in
          </h1>

          {runtimeStatus === "error" ? (
            <div role="alert" className="mt-7 rounded-2xl bg-canvas p-5">
              <p className="font-semibold text-ink">
                {runtimeErrorMessage ?? "Tokenly could not open."}
              </p>
              <button
                type="button"
                disabled={isRetrying}
                onClick={() => void retryRuntime()}
                className="mt-4 min-h-12 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isRetrying ? "Opening..." : "Try again"}
              </button>
            </div>
          ) : (
            <form
              className="mt-7"
              onSubmit={(event) => void submitEntry(event)}
            >
              <label
                htmlFor="username"
                className="text-sm font-semibold text-ink"
              >
                Username
              </label>
              <div className="relative mt-2">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
                />
                <input
                  {...usernameRegistration}
                  id="username"
                  type="text"
                  autoComplete="username"
                  aria-invalid={
                    errors.username === undefined ? undefined : true
                  }
                  aria-describedby="username-error"
                  disabled={isBusy}
                  className="min-h-14 w-full rounded-2xl bg-canvas py-3 pr-4 pl-12 text-lg text-ink ring-1 ring-ink/8 transition outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-strong disabled:cursor-wait disabled:opacity-60"
                />
              </div>
              {errors.username?.message !== undefined && (
                <p
                  id="username-error"
                  role="alert"
                  className="mt-2 text-sm font-semibold text-danger"
                >
                  {errors.username.message}
                </p>
              )}

              <label
                htmlFor="password"
                className="mt-5 block text-sm font-semibold text-ink"
              >
                Password
              </label>
              <div className="relative mt-2">
                <LockKeyhole
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
                />
                <input
                  {...passwordRegistration}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={
                    errors.password === undefined ? undefined : true
                  }
                  aria-describedby="password-error"
                  disabled={isBusy}
                  className="min-h-14 w-full rounded-2xl bg-canvas py-3 pr-4 pl-12 text-lg text-ink ring-1 ring-ink/8 transition outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-strong disabled:cursor-wait disabled:opacity-60"
                />
              </div>
              {errors.password?.message !== undefined && (
                <p
                  id="password-error"
                  role="alert"
                  className="mt-2 text-sm font-semibold text-danger"
                >
                  {errors.password.message}
                </p>
              )}

              {errors.root?.message !== undefined && (
                <div
                  role="alert"
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
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
                      className="mt-3 min-h-11 rounded-full bg-white px-4 py-2 font-semibold text-ink shadow-soft disabled:cursor-wait disabled:opacity-60"
                    >
                      {isRetrying ? "Opening..." : "Try again"}
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-bold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong disabled:cursor-wait disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-5 motion-safe:animate-spin"
                    />
                    Logging in...
                  </>
                ) : (
                  <>
                    Log in
                    <ArrowRight aria-hidden="true" className="size-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {qrMode !== undefined && (
            <div className="mt-7 border-t border-ink/10 pt-6">{qrMode}</div>
          )}
        </div>
      </section>
    </main>
  );
}
