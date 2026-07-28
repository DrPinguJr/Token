import { QrCode, WalletCards } from "lucide-react";
import Link from "next/link";

import type { CustomerWalletPageReadModel } from "../customer-portal-read-model";
import { CustomerTransactionList } from "./customer-transaction-list";
import {
  WalletPinChangePanel,
  type WalletPinChangePanelProps,
} from "./wallet-pin-change-panel";

export function CustomerWalletScreen({
  walletPage,
  onChangePin,
}: Readonly<
  {
    walletPage: CustomerWalletPageReadModel;
  } & WalletPinChangePanelProps
>) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
        <div className="tokenly-court-lines relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-floating sm:p-8">
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.08em] text-white/70 uppercase">
                  Available balance
                </p>
                <p className="mt-3 text-[clamp(3.25rem,13vw,5.5rem)] leading-none font-bold tracking-[-0.065em] tabular-nums">
                  {walletPage.wallet.balance}
                </p>
                <p className="mt-2 font-medium text-white/72">tokens</p>
              </div>
              <WalletCards
                aria-hidden="true"
                className="hidden size-12 text-brand-blue sm:block"
              />
            </div>
            <p className="mt-6 text-sm leading-6 text-white/68">
              This balance is calculated from your immutable wallet activity.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-card bg-brand-blue-soft p-6 shadow-soft">
          <div>
            <p className="text-sm font-semibold text-brand-blue-strong">
              Your customer code
            </p>
            <h2 className="mt-2 text-xl font-bold text-ink">
              Ready for event staff
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Your QR contains an opaque customer code—never your PIN, balance,
              or mobile number.
            </p>
          </div>
          <Link
            href="/customer/wallet/qr"
            className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            <QrCode aria-hidden="true" className="size-5" />
            Show my QR
          </Link>
        </div>
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft sm:p-6">
        <div className="px-2">
          <p className="text-sm font-semibold text-brand-blue-strong">
            Ledger-derived
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink">Wallet activity</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Every token top-up, purchase, refund, and adjustment is shown from
            the recorded ledger.
          </p>
        </div>
        <div className="mt-3">
          <CustomerTransactionList transactions={walletPage.transactions} />
        </div>
      </section>

      <WalletPinChangePanel onChangePin={onChangePin} />
    </div>
  );
}
