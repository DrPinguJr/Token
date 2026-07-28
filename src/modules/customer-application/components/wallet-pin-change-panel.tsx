"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  walletPinSchema,
  type PinChangeResult,
} from "@/modules/authentication";

const pinChangeFormSchema = z
  .object({
    currentPin: walletPinSchema,
    newPin: walletPinSchema,
    confirmNewPin: walletPinSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.newPin !== input.confirmNewPin) {
      context.addIssue({
        code: "custom",
        message: "The new PINs do not match.",
        path: ["confirmNewPin"],
      });
    }
  });

type PinChangeFormInput = z.infer<typeof pinChangeFormSchema>;

export interface WalletPinChangePanelProps {
  readonly onChangePin: (
    currentPin: string,
    newPin: string,
  ) => Promise<PinChangeResult>;
}

export function WalletPinChangePanel({
  onChangePin,
}: WalletPinChangePanelProps) {
  const [feedback, setFeedback] = useState<{
    readonly kind: "error" | "success";
    readonly message: string;
  } | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<PinChangeFormInput>({
    resolver: zodResolver(pinChangeFormSchema),
    defaultValues: {
      currentPin: "",
      newPin: "",
      confirmNewPin: "",
    },
  });

  async function submitPinChange(input: PinChangeFormInput): Promise<void> {
    setFeedback(null);

    try {
      const result = await onChangePin(input.currentPin, input.newPin);

      if (result.status === "changed") {
        setFeedback({
          kind: "success",
          message: "Your wallet PIN has been changed.",
        });
      } else if (result.status === "locked") {
        setFeedback({
          kind: "error",
          message:
            "PIN changes are temporarily unavailable after repeated attempts. Try again later.",
        });
      } else {
        setFeedback({
          kind: "error",
          message:
            "The PIN could not be changed. Check your current PIN and try again.",
        });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "The PIN could not be changed right now. Try again.",
      });
    } finally {
      reset();
    }
  }

  const pinFieldClassName =
    "mt-2 min-h-12 w-full rounded-2xl bg-canvas-soft px-4 text-lg tracking-[0.35em] text-ink ring-1 ring-ink/8 outline-none transition placeholder:tracking-normal placeholder:text-ink-muted/70 focus:bg-white focus:ring-2 focus:ring-focus";

  return (
    <section className="rounded-card bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Change wallet PIN</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Use exactly four digits. PINs stay out of wallet activity and audit
            details.
          </p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit(submitPinChange)}
        className="mt-6 space-y-4"
      >
        <div>
          <label
            htmlFor="current-pin"
            className="text-sm font-semibold text-ink"
          >
            Current PIN
          </label>
          <input
            id="current-pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={4}
            placeholder="4 digits"
            aria-invalid={errors.currentPin ? "true" : undefined}
            aria-describedby={
              errors.currentPin ? "current-pin-error" : undefined
            }
            className={pinFieldClassName}
            {...register("currentPin")}
          />
          {errors.currentPin && (
            <p
              id="current-pin-error"
              role="alert"
              className="mt-2 text-sm font-medium text-danger"
            >
              Enter your four-digit current PIN.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-pin" className="text-sm font-semibold text-ink">
              New PIN
            </label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="4 digits"
              aria-invalid={errors.newPin ? "true" : undefined}
              aria-describedby={errors.newPin ? "new-pin-error" : undefined}
              className={pinFieldClassName}
              {...register("newPin")}
            />
            {errors.newPin && (
              <p
                id="new-pin-error"
                role="alert"
                className="mt-2 text-sm font-medium text-danger"
              >
                Enter a four-digit new PIN.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-new-pin"
              className="text-sm font-semibold text-ink"
            >
              Confirm new PIN
            </label>
            <input
              id="confirm-new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="Repeat PIN"
              aria-invalid={errors.confirmNewPin ? "true" : undefined}
              aria-describedby={
                errors.confirmNewPin ? "confirm-new-pin-error" : undefined
              }
              className={pinFieldClassName}
              {...register("confirmNewPin")}
            />
            {errors.confirmNewPin && (
              <p
                id="confirm-new-pin-error"
                role="alert"
                className="mt-2 text-sm font-medium text-danger"
              >
                {errors.confirmNewPin.message}
              </p>
            )}
          </div>
        </div>

        {feedback && (
          <p
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              feedback.kind === "success"
                ? "bg-brand-mint-soft text-success"
                : "bg-brand-pink-soft text-danger"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <KeyRound aria-hidden="true" className="size-5" />
              Changing PIN…
            </>
          ) : (
            <>
              <ShieldCheck aria-hidden="true" className="size-5" />
              Change PIN
            </>
          )}
        </button>
      </form>
    </section>
  );
}
