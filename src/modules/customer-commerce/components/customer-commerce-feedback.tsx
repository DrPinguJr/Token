import { AlertCircle, PackageOpen, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export interface CustomerCommerceLoadingProps {
  readonly label: string;
}

export function CustomerCommerceLoading({
  label,
}: CustomerCommerceLoadingProps) {
  return (
    <div
      role="status"
      className="grid min-h-64 place-items-center rounded-card bg-white p-8 text-center shadow-soft"
    >
      <div>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-brand-blue-soft motion-reduce:animate-none" />
        <p className="mt-4 font-medium text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

export interface CustomerCommerceErrorStateProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry?: () => void;
}

export function CustomerCommerceErrorState({
  title,
  message,
  onRetry,
}: CustomerCommerceErrorStateProps) {
  return (
    <div className="rounded-card bg-brand-pink-soft p-6 text-center shadow-soft">
      <AlertCircle
        aria-hidden="true"
        className="mx-auto h-10 w-10 text-danger"
      />
      <h2 className="mt-3 text-xl font-bold text-ink">{title}</h2>
      <p role="alert" className="mt-2 leading-7 text-ink-muted">
        {message}
      </p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}

export interface CustomerCommerceEmptyStateProps {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}

export function CustomerCommerceEmptyState({
  title,
  message,
  action,
}: CustomerCommerceEmptyStateProps) {
  return (
    <div className="rounded-card bg-white p-8 text-center shadow-soft">
      <PackageOpen
        aria-hidden="true"
        className="mx-auto h-11 w-11 text-brand-blue-strong"
      />
      <h2 className="mt-3 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 leading-7 text-ink-muted">{message}</p>
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  );
}
