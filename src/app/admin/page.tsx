import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, ShieldCheck, WalletCards } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-card bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
          Local prototype
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">
          Super-admin dashboard
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-ink-muted">
          Manage one-time claim QR distribution for tokeners. This local admin
          surface does not configure Supabase, Vercel, real identity checks, or
          production payment verification.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/tokeners"
          className="rounded-card bg-brand-blue-soft p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised"
        >
          <QrCode
            aria-hidden="true"
            className="size-8 text-brand-blue-strong"
          />
          <h2 className="mt-5 text-xl font-bold text-ink">Open claim QR</h2>
          <p className="mt-2 leading-7 text-ink-muted">
            Select Lance or another tokener and show a one-time claim QR.
          </p>
        </Link>
        <div className="rounded-card bg-brand-mint-soft p-6 shadow-soft">
          <WalletCards
            aria-hidden="true"
            className="size-8 text-brand-mint-strong"
          />
          <h2 className="mt-5 text-xl font-bold text-ink">
            Separate wallet QR
          </h2>
          <p className="mt-2 leading-7 text-ink-muted">
            Tokeners can regenerate vendor-facing wallet QR codes without
            changing their private account link.
          </p>
        </div>
        <div className="rounded-card bg-brand-pink-soft p-6 shadow-soft">
          <ShieldCheck
            aria-hidden="true"
            className="size-8 text-brand-pink-strong"
          />
          <h2 className="mt-5 text-xl font-bold text-ink">No sign-up flow</h2>
          <p className="mt-2 leading-7 text-ink-muted">
            A private link opens the tokener balance, history, and wallet QR.
          </p>
        </div>
      </div>
    </div>
  );
}
