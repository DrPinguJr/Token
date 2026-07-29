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
  useRef,
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

export function calculateOneToOneTokenAmount(amountCents: number): number {
  return Number.isSafeInteger(amountCents) && amountCents > 0
    ? amountCents / 100
    : 0;
}

export function AdminAddCreditsDialog({
  customerId,
  customerName,
  onClose,
  onComplete,
  submitCredits,
}: AdminAddCreditsDialogProps) {
  const titleId = useId();
  const uploadInputId = useId();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "paynow">(
    "paynow",
  );
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<
    "closed" | "error" | "ready" | "starting"
  >("closed");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const amountCents = parseAmountCents(amount);
  const tokenAmount =
    amountCents === null ? 0 : calculateOneToOneTokenAmount(amountCents);

  function stopCamera(): void {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }

    setCameraState("closed");
  }

  function closeDialog(): void {
    stopCamera();
    onClose();
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isSaving) {
        closeDialog();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  });

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

  useEffect(
    () => () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (cameraState !== "ready" || videoRef.current === null) {
      return;
    }

    videoRef.current.srcObject = cameraStreamRef.current;
    void videoRef.current.play().catch(() => {
      setCameraState("error");
      setMessage("Camera preview could not start. Try opening camera again.");
    });
  }, [cameraState]);

  function setEvidenceFile(selectedFile: File | null): void {
    setMessage(null);

    if (selectedFile === null) {
      setEvidence(null);
      setEvidencePreview((currentPreview) => {
        if (
          currentPreview !== null &&
          typeof URL.revokeObjectURL === "function"
        ) {
          URL.revokeObjectURL(currentPreview);
        }

        return null;
      });
      return;
    }

    if (!acceptedEvidenceTypes.has(selectedFile.type)) {
      setEvidence(null);
      setEvidencePreview(null);
      setMessage("Use a HEIC, HEIF, JPEG, PNG, or WebP image.");
      return;
    }

    if (selectedFile.size > maximumEvidenceBytes) {
      setEvidence(null);
      setEvidencePreview(null);
      setMessage("The evidence image must be 10 MB or smaller.");
      return;
    }

    setEvidence(selectedFile);
    setEvidencePreview((currentPreview) => {
      if (
        currentPreview !== null &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(currentPreview);
      }

      return typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(selectedFile)
        : null;
    });
    setMessage(null);
    stopCamera();
    setStep(2);
  }

  function selectEvidence(event: ChangeEvent<HTMLInputElement>): void {
    setEvidenceFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  async function openCamera(): Promise<void> {
    setMessage(null);

    if (navigator.mediaDevices?.getUserMedia === undefined) {
      setCameraState("error");
      setMessage(
        "Camera capture is unavailable in this browser. Open Tokenly on HTTPS with camera permission, or use Upload image.",
      );
      return;
    }

    stopCamera();
    setCameraState("starting");

    try {
      cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraState("ready");
    } catch {
      cameraStreamRef.current = null;
      setCameraState("error");
      setMessage(
        "Camera could not open. Allow camera permission, then try again.",
      );
    }
  }

  async function captureCameraPhoto(): Promise<void> {
    const video = videoRef.current;
    if (video === null || video.videoWidth === 0 || video.videoHeight === 0) {
      setMessage("Camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );

    if (blob === null) {
      setMessage("Photo could not be captured. Try again.");
      return;
    }

    setEvidenceFile(
      new File([blob], `payment-evidence-${Date.now()}.jpg`, {
        type: "image/jpeg",
      }),
    );
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
        "Credits could not be issued. Try again or ask an administrator to check the database setup.",
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
          closeDialog();
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
            onClick={closeDialog}
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
              <button
                type="button"
                onClick={() => void openCamera()}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 font-semibold text-white shadow-raised"
              >
                <Camera aria-hidden="true" className="size-5" />
                Take photo
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-semibold text-ink shadow-soft ring-1 ring-ink/10"
              >
                <Upload aria-hidden="true" className="size-5" />
                Upload image
              </button>
              <input
                id={uploadInputId}
                ref={uploadInputRef}
                type="file"
                aria-label="Upload evidence image"
                accept="image/heic,image/heif,image/jpeg,image/png,image/webp"
                onChange={selectEvidence}
                className="sr-only"
              />
            </div>

            {cameraState !== "closed" && (
              <section className="mt-4 rounded-3xl bg-ink p-3 text-white shadow-raised">
                {cameraState === "starting" ? (
                  <p role="status" className="px-3 py-10 text-center">
                    Opening camera...
                  </p>
                ) : cameraState === "error" ? (
                  <div className="px-3 py-5 text-center">
                    <p className="font-bold">Camera unavailable</p>
                    <p className="mt-2 text-sm text-white/72">
                      Allow camera permission and make sure Tokenly is opened on
                      HTTPS, then try again.
                    </p>
                    <button
                      type="button"
                      onClick={() => void openCamera()}
                      className="mt-4 min-h-11 rounded-full bg-white px-4 py-2 font-bold text-ink"
                    >
                      Try camera again
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
                    />
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => void captureCameraPhoto()}
                        disabled={cameraState !== "ready"}
                        className="min-h-12 rounded-full bg-white px-4 py-3 font-bold text-ink disabled:cursor-wait disabled:opacity-60"
                      >
                        Capture photo
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="min-h-12 rounded-full bg-white/12 px-4 py-3 font-bold text-white"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

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
              S$1.00 = 1 token.
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

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-blue-soft p-4">
              <span className="text-sm font-semibold text-ink">
                Tokens to issue
              </span>
              <strong className="text-2xl text-brand-blue-strong">
                {tokenAmount}
              </strong>
            </div>
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
