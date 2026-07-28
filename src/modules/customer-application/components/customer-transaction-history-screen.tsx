import { ListFilter } from "lucide-react";

import type { CustomerTransactionHistoryReadModel } from "../customer-portal-read-model";
import { CustomerTransactionList } from "./customer-transaction-list";

export function CustomerTransactionHistoryScreen({
  history,
}: Readonly<{ history: CustomerTransactionHistoryReadModel }>) {
  return (
    <div className="space-y-6">
      <section className="rounded-card bg-brand-blue-soft p-5 shadow-soft sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-brand-blue-strong shadow-soft">
            <ListFilter aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-blue-strong">
              Complete activity
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">
              Every recorded token movement
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-ink-muted">
              Top-ups, purchases, refunds, and adjustments are listed from your
              wallet ledger. Open any item for its persisted reference and
              linked details.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Transaction history"
        className="rounded-card bg-white p-4 shadow-soft sm:p-6"
      >
        <CustomerTransactionList
          transactions={history.transactions}
          emptyActionHref="/customer/wallet/qr"
          emptyActionLabel="Show my QR"
        />
      </section>
    </div>
  );
}
