"use client";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

const maximumEvidenceBytes = 10 * 1024 * 1024;
const acceptedEvidenceTypes = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface AddCreditsInput {
  readonly amountCents: number;
  readonly customerId: string;
  readonly evidence: File;
  readonly paymentMethod: "cash" | "paynow";
}

interface AdminAddCreditsDialogProps {
  readonly customerId: string;
  readonly customerName: string;
  readonly onClose: () => void;
  readonly onComplete: () => void;
  readonly submitCredits: (input: AddCreditsInput) => Promise<void>;
}

function parseAmountCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function AdminAddCreditsDialog({
  customerId,
  customerName,
  onClose,
  onComplete,
  submitCredits,
}: AdminAddCreditsDialogProps) {
  const titleId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "paynow">(
    "paynow",
  );
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSaving, onClose]);

  useEffect(
    () => () => {
      if (
        evidencePreview !== null &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(evidencePreview);
      }
    },
    [evidencePreview],
  );

  function selectEvidence(event: ChangeEvent<HTMLInputElement>): void {
    const selectedFile = event.target.files?.[0] ?? null;
    setMessage(null);

    if (selectedFile === null) {
      setEvidence(null);
      setEvidencePreview(null);
      return;
    }

    if (!acceptedEvidenceTypes.has(selectedFile.type)) {
      setEvidence(null);
      setEvidencePreview(null);
      setMessage("Use a HEIC, HEIF, JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > maximumEvidenceBytes) {
      setEvidence(null);
      setEvidencePreview(null);
      setMessage("The evidence image must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setEvidence(selectedFile);
    setEvidencePreview(
      typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(selectedFile)
        : null,
    );
    setMessage(null);
    setStep(2);
  }

  function continueToAmount(): void {
    if (evidence === null) {
      setMessage("Take or upload an evidence photo before continuing.");
      return;
    }

    setMessage(null);
    setStep(2);
  }

  async function confirmCredits(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const amountCents = parseAmountCents(amount);

    if (evidence === null) {
      setStep(1);
      setMessage("Take or upload an evidence photo before continuing.");
      return;
    }

    if (amountCents === null) {
      setMessage("Enter a valid amount greater than $0.00.");
      return;
    }

    setMessage(null);
    setIsSaving(true);
    try {
      await submitCredits({
        amountCents,
        customerId,
        evidence,
        paymentMethod,
      });
      onComplete();
    } catch {
      setMessage(
        "Credits could not be issued. No wallet credit was reported as complete.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-ink/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-floating sm:max-w-lg sm:rounded-[2rem] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
              Step {step} of 2
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-bold text-ink">
              Add credits to {customerName}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close add credits"
            disabled={isSaving}
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-ink disabled:cursor-wait"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2" aria-hidden="true">
          <span className="h-2 rounded-full bg-brand-blue-strong" />
          <span
            className={`h-2 rounded-full ${
              step === 2 ? "bg-brand-blue-strong" : "bg-ink/10"
            }`}
          />
        </div>

        {step === 1 ? (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-ink">
              Capture payment evidence
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Take a photo of the PayNow confirmation or cash received. Tokenly
              records this as manual evidence; it does not verify payment.
            </p>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">
                Payment method
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["paynow", "cash"] as const).map((method) => (
                  <label
                    key={method}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-full px-4 py-3 font-bold ${
                      paymentMethod === method
                        ? "bg-ink text-white"
                        : "bg-canvas text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="sr-only"
                    />
                    {method === "paynow" ? "PayNow" : "Cash"}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 rounded-3xl border-2 border-dashed border-brand-blue/70 bg-brand-blue-soft/55 p-5 text-center">
              {evidencePreview === null ? (
                <span className="block">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-brand-blue-strong shadow-soft">
                    <Camera aria-hidden="true" className="size-6" />
                  </span>
                  <span className="mt-3 block font-bold text-ink">
                    Add payment evidence
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    HEIC, HEIF, JPEG, PNG, or WebP · maximum 10 MB
                  </span>
                </span>
              ) : (
                <span className="block">
                  {/* A local object URL is used only for this on-device preview. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidencePreview}
                    alt="Selected payment evidence preview"
                    className="mx-auto max-h-64 rounded-2xl object-contain"
                  />
                  <span className="mt-3 inline-flex items-center gap-2 font-bold text-ink">
                    <ImagePlus aria-hidden="true" className="size-5" />
                    Evidence selected
                  </span>
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 font-semibold text-white shadow-raised">
                <Camera aria-hidden="true" className="size-5" />
                Take photo
                <input
                  type="file"
                  aria-label="Take evidence photo"
                  accept="image/*"
                  capture="environment"
                  onChange={selectEvidence}
                  className="sr-only"
                />
              </label>
              <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-semibold text-ink shadow-soft ring-1 ring-ink/10">
                <Upload aria-hidden="true" className="size-5" />
                Upload image
                <input
                  type="file"
                  aria-label="Upload evidence image"
                  accept="image/heic,image/heif,image/jpeg,image/png,image/webp"
                  onChange={selectEvidence}
                  className="sr-only"
                />
              </label>
            </div>

            {evidence !== null && (
              <p className="mt-3 text-sm font-medium break-all text-ink-muted">
                Selected: {evidence.name}
              </p>
            )}

            <button
              type="button"
              onClick={continueToAmount}
              className="mt-6 min-h-12 w-full rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised"
            >
              Next: enter amount
            </button>
          </div>
        ) : (
          <form
            className="mt-6"
            onSubmit={(event) => void confirmCredits(event)}
          >
            <h3 className="text-lg font-bold text-ink">
              Enter amount received
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              The current event conversion rate will be applied when you
              confirm.
            </p>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-ink">
                Amount received (SGD)
              </span>
              <span className="mt-2 flex min-h-14 items-center rounded-2xl bg-canvas px-4 text-xl font-bold text-ink focus-within:ring-2 focus-within:ring-focus">
                <span aria-hidden="true">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none"
                />
              </span>
            </label>

            <div className="mt-5 rounded-2xl bg-brand-mint-soft p-4 text-sm leading-6 text-ink">
              <p className="flex items-start gap-2 font-semibold">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-brand-mint-strong"
                />
                On confirmation, Tokenly records the evidence and audit trail
                before the wallet credit is committed.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setMessage(null);
                  setStep(1);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-canvas px-5 py-3 font-semibold text-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-12 rounded-full bg-brand-mint-strong px-5 py-3 font-semibold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
              >
                {isSaving ? "Recording and issuing..." : "Confirm add credits"}
              </button>
            </div>
          </form>
        )}

        {message !== null && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
          >
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
