import {
  ArrowRight,
  CalendarDays,
  MapPin,
  QrCode,
  ScanLine,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import type { CustomerHomeReadModel } from "../customer-portal-read-model";
import { formatCustomerEventDateRange } from "./customer-display-formatters";
import { CustomerTransactionList } from "./customer-transaction-list";

export function CustomerHomeScreen({
  home,
}: Readonly<{ home: CustomerHomeReadModel }>) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-card bg-brand-pink-soft p-5 shadow-soft sm:p-7">
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 size-40 rounded-full bg-white/55"
        />
        <div className="relative">
          <p className="text-sm font-semibold text-brand-pink-strong">
            {home.event.name}
          </p>
          <h2 className="mt-2 text-2xl leading-tight font-bold tracking-[-0.035em] text-ink sm:text-3xl">
            Welcome back, Tokener
          </h2>
          <p className="mt-2 text-ink-muted">
            Hi {home.customer.displayName}. {home.event.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatCustomerEventDateRange(
                home.event.startsAt,
                home.event.endsAt,
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4" />
              {home.event.venue}
            </span>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="wallet-balance-heading"
        className="tokenly-court-lines relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-floating sm:p-8"
      >
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                id="wallet-balance-heading"
                className="text-sm font-semibold tracking-[0.08em] text-white/70 uppercase"
              >
                Wallet balance
              </p>
              <p className="mt-2 text-[clamp(3.25rem,13vw,5.5rem)] leading-none font-bold tracking-[-0.065em] tabular-nums">
                {home.wallet.balance}
              </p>
              <p className="mt-2 font-medium text-white/72">tokens</p>
            </div>
            <span className="hidden size-20 place-items-center rounded-[1.75rem] bg-white/10 text-brand-blue sm:grid">
              <WalletCards aria-hidden="true" className="size-9" />
            </span>
          </div>

          {home.wallet.status === "frozen" && (
            <p
              role="status"
              className="mt-5 rounded-2xl bg-white/12 px-4 py-3 text-sm font-semibold"
            >
              This wallet is frozen. You can still review its activity.
            </p>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {home.wallet.status === "active" ? (
              <Link
                href="/customer/scan"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 font-bold text-ink shadow-raised transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-blue"
              >
                <ScanLine aria-hidden="true" className="size-5" />
                Scan to pay
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title="This wallet is frozen"
                className="inline-flex min-h-13 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/55 px-5 py-3.5 font-bold text-ink/55"
              >
                <ScanLine aria-hidden="true" className="size-5" />
                Scan unavailable
              </span>
            )}
            <Link
              href="/customer/vendors"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-brand-blue px-5 py-3.5 font-bold text-ink shadow-raised transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              <Store aria-hidden="true" className="size-5" />
              Browse vendors
            </Link>
            <Link
              href="/customer/wallet/qr"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white/12 px-5 py-3.5 font-semibold text-white ring-1 ring-white/22 transition hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-blue"
            >
              <QrCode aria-hidden="true" className="size-5" />
              Show my QR
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-4 px-2">
          <div>
            <p className="text-sm font-semibold text-brand-blue-strong">
              Your wallet
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">Recent activity</h2>
          </div>
          <Link
            href="/customer/transactions"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-blue-strong transition hover:bg-brand-blue-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            See all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="mt-3">
          <CustomerTransactionList transactions={home.recentTransactions} />
        </div>
      </section>
    </div>
  );
}
