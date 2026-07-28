import { ArrowDownLeft, ArrowRight, ArrowUpRight, History } from "lucide-react";
import Link from "next/link";

import type { CustomerTransactionListItem } from "../customer-portal-read-model";
import { formatCustomerTransactionTime } from "./customer-display-formatters";

export function CustomerTransactionList({
  transactions,
  emptyActionHref = "/customer/vendors",
  emptyActionLabel = "Browse vendors",
}: Readonly<{
  transactions: readonly CustomerTransactionListItem[];
  emptyActionHref?: string;
  emptyActionLabel?: string;
}>) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-card bg-canvas-soft p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-ink-muted shadow-soft">
          <History aria-hidden="true" className="size-6" />
        </span>
        <h3 className="mt-4 font-bold text-ink">No wallet activity yet</h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Token top-ups, purchases, refunds, and adjustments will appear here.
        </p>
        <Link
          href={emptyActionHref}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          {emptyActionLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-ink/6">
      {transactions.map((transaction) => {
        const isCredit = transaction.direction === "credit";
        const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;

        return (
          <li key={transaction.id}>
            <Link
              href={`/customer/transactions/${encodeURIComponent(transaction.transactionId)}`}
              className="group grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-canvas-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:gap-4 sm:px-3"
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
                  {transaction.title}
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink-muted">
                  {transaction.subtitle} ·{" "}
                  {formatCustomerTransactionTime(transaction.occurredAt)}
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
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
