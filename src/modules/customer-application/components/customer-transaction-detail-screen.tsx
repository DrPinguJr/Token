import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  RotateCcw,
  ScanLine,
  Store,
} from "lucide-react";
import Link from "next/link";

import type { CustomerTransactionDetailReadModel } from "../customer-portal-read-model";
import {
  formatCustomerTransactionTime,
  formatPaynowAmount,
} from "./customer-display-formatters";

export function CustomerTransactionDetailScreen({
  detail,
  showReceipt,
}: Readonly<{
  detail: CustomerTransactionDetailReadModel;
  showReceipt: boolean;
}>) {
  const isPurchaseReceipt =
    showReceipt && detail.kind === "purchase" && detail.order !== null;
  const isCredit = detail.direction === "credit";
  const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/customer/transactions"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to activity
      </Link>

      {isPurchaseReceipt && (
        <section
          role="status"
          className="rounded-[2rem] bg-brand-mint-soft p-6 text-center shadow-soft sm:p-8"
        >
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-success shadow-soft">
            <BadgeCheck aria-hidden="true" className="size-9" />
          </span>
          <p className="mt-5 text-sm font-bold tracking-[0.09em] text-success uppercase">
            Purchase complete
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-ink">
            Enjoy your order
          </h2>
          <p className="mt-2 text-ink-muted">
            Your completed order and wallet debit were recorded together.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-card bg-white shadow-soft">
        <div className="flex items-start gap-4 p-5 sm:p-7">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
              isCredit
                ? "bg-brand-mint-soft text-success"
                : "bg-brand-blue-soft text-brand-blue-strong"
            }`}
          >
            <DirectionIcon aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-muted">
              {formatCustomerTransactionTime(detail.occurredAt)}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">
              {detail.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {detail.description}
            </p>
          </div>
          <p
            className={`text-2xl font-bold whitespace-nowrap tabular-nums ${
              isCredit ? "text-success" : "text-ink"
            }`}
          >
            {isCredit ? "+" : "−"}
            {detail.tokenAmount}
          </p>
        </div>

        <dl className="grid gap-px bg-ink/5 sm:grid-cols-2">
          <div className="bg-canvas-soft px-5 py-4 sm:px-7">
            <dt className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
              Reference
            </dt>
            <dd className="mt-1 font-semibold break-all text-ink tabular-nums">
              {detail.reference}
            </dd>
          </div>
          <div className="bg-canvas-soft px-5 py-4 sm:px-7">
            <dt className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
              Transaction group
            </dt>
            <dd className="mt-1 text-sm font-medium break-all text-ink">
              {detail.transactionGroupId}
            </dd>
          </div>
        </dl>
      </section>

      {detail.order !== null && (
        <section className="rounded-card bg-white p-5 shadow-soft sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-brand-blue-strong">
                Persisted order
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink">
                {detail.vendorName ?? "Order details"}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {detail.order.reference} ·{" "}
                {formatCustomerTransactionTime(detail.order.completedAt)}
              </p>
            </div>
            <Store
              aria-hidden="true"
              className="size-6 shrink-0 text-brand-blue-strong"
            />
          </div>

          <ul className="mt-5 divide-y divide-ink/6">
            {detail.order.items.map((item) => (
              <li
                key={`${item.productId}:${item.unitTokenPrice}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3"
              >
                <div>
                  <p className="font-semibold text-ink">{item.productName}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {item.quantity} × {item.unitTokenPrice} tokens
                  </p>
                </div>
                <p className="font-bold text-ink tabular-nums">
                  {item.lineTokenTotal}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-ink/8 pt-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-semibold text-ink-muted">Order total</dt>
              <dd className="text-lg font-bold text-ink tabular-nums">
                {detail.order.tokenTotal} tokens
              </dd>
            </div>
            {detail.order.refundedTokenAmount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="font-semibold text-success">Refunded</dt>
                <dd className="font-bold text-success tabular-nums">
                  {detail.order.refundedTokenAmount} tokens
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {detail.refunds.length > 0 && (
        <section className="rounded-card bg-brand-mint-soft p-5 shadow-soft sm:p-7">
          <div className="flex items-center gap-3">
            <RotateCcw aria-hidden="true" className="size-5 text-success" />
            <h2 className="text-lg font-bold text-ink">Refunds</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {detail.refunds.map((refund) => (
              <li
                key={refund.id}
                className={`rounded-2xl bg-white p-4 shadow-soft ${
                  refund.id === detail.selectedRefundId
                    ? "ring-2 ring-brand-mint-strong"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">{refund.reference}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {formatCustomerTransactionTime(refund.createdAt)}
                    </p>
                  </div>
                  <p className="font-bold text-success tabular-nums">
                    +{refund.tokenAmount}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  {refund.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.issuance !== null && (
        <section className="rounded-card bg-brand-pink-soft p-5 shadow-soft sm:p-7">
          <div className="flex items-center gap-3">
            <Banknote
              aria-hidden="true"
              className="size-5 text-brand-pink-strong"
            />
            <h2 className="text-lg font-bold text-ink">
              Manual token top-up record
            </h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Event staff recorded this after a manual PayNow check. Tokenly did
            not automatically verify the payment.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
                PayNow amount
              </dt>
              <dd className="mt-1 font-semibold text-ink">
                {formatPaynowAmount(detail.issuance.paynowAmountCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
                Rate snapshot
              </dt>
              <dd className="mt-1 font-semibold text-ink">
                {detail.issuance.tokensPerDollar} tokens per S$1
              </dd>
            </div>
            {detail.issuance.paymentReference !== null && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
                  Payment reference
                </dt>
                <dd className="mt-1 font-semibold break-all text-ink">
                  {detail.issuance.paymentReference}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <nav
        aria-label="Transaction next actions"
        className="grid gap-3 sm:grid-cols-2"
      >
        <Link
          href="/customer/scan"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          <ScanLine aria-hidden="true" className="size-5" />
          Scan to pay
        </Link>
        <Link
          href="/customer/vendors"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-ink shadow-soft transition hover:bg-canvas-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          Browse vendors
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </nav>
    </div>
  );
}
