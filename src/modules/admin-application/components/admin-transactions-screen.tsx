"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type {
  AdminTransactionListItem,
  AdminTransactionOverview,
} from "../admin-transaction-read-model";

export interface AdminTransactionsScreenProps {
  readonly loadOverview: () => Promise<AdminTransactionOverview>;
}

function formatEntryType(
  entryType: AdminTransactionListItem["entryType"],
): string {
  return entryType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const emptyOverview: AdminTransactionOverview = {
  metrics: {
    issuedTokens: 0,
    refundedTokens: 0,
    spentTokens: 0,
    transactionGroups: 0,
  },
  transactions: [],
};

export function AdminTransactionsScreen({
  loadOverview,
}: AdminTransactionsScreenProps) {
  const [overview, setOverview] = useState<AdminTransactionOverview | null>(
    null,
  );
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    void Promise.resolve()
      .then(async () => {
        if (!active) {
          return null;
        }

        setErrorCode(null);
        setOverview(null);
        return loadOverview();
      })
      .then((loadedOverview) => {
        if (active && loadedOverview !== null) {
          setOverview(loadedOverview);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOverview(emptyOverview);
          setErrorCode(
            error instanceof Error ? error.message : "TOKENLY_API_ERROR",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [loadOverview, reloadVersion]);

  const metrics = overview?.metrics ?? emptyOverview.metrics;

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
          Supabase activity
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Transactions</h1>
        <p className="mt-3 max-w-3xl leading-7 text-ink-muted">
          Ledger activity stored in the hosted Tokenly database. Empty values
          remain at zero until credits, purchases, or refunds are recorded.
        </p>
      </section>

      <section
        aria-label="Transaction metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <MetricCard
          icon={<History />}
          label="Transaction groups"
          value={metrics.transactionGroups}
        />
        <MetricCard
          icon={<WalletCards />}
          label="Credits issued"
          value={metrics.issuedTokens}
        />
        <MetricCard
          icon={<ShoppingBag />}
          label="Customer spend"
          value={metrics.spentTokens}
        />
        <MetricCard
          icon={<RotateCcw />}
          label="Customer refunds"
          value={metrics.refundedTokens}
        />
      </section>

      {errorCode !== null && (
        <section className="rounded-card border border-brand-pink/50 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-ink">
            Supabase activity could not load
          </h2>
          <p role="alert" className="mt-2 leading-7 text-ink-muted">
            {errorCode === "SUPABASE_SERVER_CONFIGURATION_ERROR"
              ? "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local, then restart the development server."
              : errorCode === "PROTOTYPE_SESSION_ROLE_UNAVAILABLE"
                ? "Your hosted admin session is missing or expired. Sign out, then sign in as AdminLance again."
                : "The hosted transaction records are temporarily unavailable. The zero metrics above are placeholders, not confirmed database totals."}
          </p>
          <button
            type="button"
            onClick={() => setReloadVersion((current) => current + 1)}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white"
          >
            <RefreshCw aria-hidden="true" className="size-5" />
            Try again
          </button>
        </section>
      )}

      {overview === null && (
        <p
          role="status"
          className="w-fit rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
        >
          Loading Supabase activity...
        </p>
      )}

      {overview !== null &&
        errorCode === null &&
        (overview.transactions.length === 0 ? (
          <section className="rounded-card bg-white p-8 text-center shadow-soft">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-canvas text-ink-muted">
              <History aria-hidden="true" className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink">
              No transactions yet
            </h2>
            <p className="mt-2 text-ink-muted">
              Supabase is connected. New credit issuances and wallet activity
              will appear here.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div className="border-b border-ink/6 px-5 py-4 sm:px-6">
              <h2 className="text-xl font-bold text-ink">Recent activity</h2>
            </div>
            <ol className="divide-y divide-ink/6">
              {overview.transactions.map((transaction) => {
                const isCredit = transaction.direction === "credit";
                const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;

                return (
                  <li
                    key={transaction.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6"
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-2xl ${
                        isCredit
                          ? "bg-brand-mint-soft text-brand-mint-strong"
                          : "bg-brand-blue-soft text-brand-blue-strong"
                      }`}
                    >
                      <DirectionIcon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {formatEntryType(transaction.entryType)}
                      </span>
                      <span className="mt-1 block truncate text-sm text-ink-muted">
                        {transaction.reference} ·{" "}
                        {formatOccurredAt(transaction.occurredAt)}
                      </span>
                      <span className="mt-1 block truncate text-sm text-ink-soft">
                        {transaction.description}
                      </span>
                    </span>
                    <span
                      className={`font-bold whitespace-nowrap tabular-nums ${
                        isCredit ? "text-success" : "text-ink"
                      }`}
                    >
                      {isCredit ? "+" : "−"}
                      {transaction.tokenAmount}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: number;
}>) {
  return (
    <article className="rounded-card bg-white p-5 shadow-soft">
      <span className="grid size-10 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-4 text-3xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-ink-muted">{label}</p>
    </article>
  );
}
