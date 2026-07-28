import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react";

export function CustomerResourceLoading({
  label = "Loading your wallet…",
}: Readonly<{ label?: string }>) {
  return (
    <div
      role="status"
      className="grid min-h-72 place-items-center rounded-card bg-white p-8 text-center shadow-soft"
    >
      <div>
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto size-8 animate-spin text-brand-blue-strong motion-reduce:animate-none"
        />
        <p className="mt-4 font-semibold text-ink">{label}</p>
      </div>
    </div>
  );
}

export function CustomerResourceError({
  onRetry,
  title = "This page could not load",
}: Readonly<{
  onRetry: () => void;
  title?: string;
}>) {
  return (
    <div className="grid min-h-72 place-items-center rounded-card bg-white p-6 text-center shadow-soft">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-pink-soft text-danger">
          <AlertCircle aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">{title}</h2>
        <p role="alert" className="mt-2 leading-6 text-ink-muted">
          Your local Tokenly data is unavailable right now. Try loading it
          again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
