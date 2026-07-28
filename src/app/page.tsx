import {
  ArrowRight,
  BadgeCheck,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { PublicShell } from "@/shared/components/public-shell";

const highlights = [
  {
    title: "One clear balance",
    description: "See every event token at a glance.",
    icon: WalletCards,
    colour: "bg-brand-blue-soft text-brand-blue-strong",
  },
  {
    title: "Quick QR payments",
    description: "Scan a vendor and confirm your order.",
    icon: QrCode,
    colour: "bg-brand-pink-soft text-brand-pink-strong",
  },
  {
    title: "Event-ready",
    description: "Built for customers, stalls, and event teams.",
    icon: Store,
    colour: "bg-brand-mint-soft text-brand-mint-strong",
  },
] as const;

export default function HomePage() {
  return (
    <PublicShell>
      <section className="grid items-center gap-12 py-8 sm:py-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-16 lg:py-20">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-sm font-semibold text-ink-muted shadow-soft ring-1 ring-ink/5 backdrop-blur">
            <Sparkles aria-hidden="true" className="size-4 text-brand-pink" />
            Two days. One simple wallet.
          </div>

          <h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.045em] text-balance text-ink sm:text-6xl lg:text-7xl">
            Your event tokens,{" "}
            <span className="text-brand-blue-strong">in one happy place.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-pretty text-ink-muted sm:text-xl">
            Tokenly keeps topping up, browsing stalls, and paying for favourites
            beautifully straightforward.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/enter"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-white shadow-raised transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong"
            >
              Enter Tokenly
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
            <Link
              href="/help"
              className="inline-flex min-h-13 items-center justify-center rounded-full bg-white/80 px-6 py-3.5 font-semibold text-ink shadow-soft ring-1 ring-ink/8 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong"
            >
              How event tokens work
            </Link>
          </div>

          <div className="mt-7 flex items-center gap-3 text-sm text-ink-muted">
            <ShieldCheck
              aria-hidden="true"
              className="size-5 shrink-0 text-brand-mint-strong"
            />
            Local prototype · No real payments or mobile verification
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -top-8 -right-4 size-28 rounded-full bg-brand-pink-soft blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-8 -left-5 size-36 rounded-full bg-brand-blue-soft blur-2xl"
          />

          <div className="tokenly-court-lines relative overflow-hidden rounded-[2rem] bg-white/88 p-5 shadow-floating ring-1 ring-white/80 backdrop-blur sm:p-7">
            <div className="relative rounded-[1.55rem] bg-ink p-6 text-white sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-white/65">
                    Sample wallet
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-[-0.05em] sm:text-6xl">
                    128
                  </p>
                  <p className="mt-1 text-sm text-white/65">event tokens</p>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
                  <WalletCards aria-hidden="true" className="size-6" />
                </span>
              </div>

              <div className="mt-9 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white px-4 py-4 text-ink shadow-soft">
                  <QrCode
                    aria-hidden="true"
                    className="mb-6 size-7 text-brand-blue-strong"
                  />
                  <p className="font-semibold">Scan to pay</p>
                </div>
                <div className="rounded-2xl bg-brand-pink-soft px-4 py-4 text-ink">
                  <Store
                    aria-hidden="true"
                    className="mb-6 size-7 text-brand-pink-strong"
                  />
                  <p className="font-semibold">Browse vendors</p>
                </div>
              </div>
            </div>

            <div className="relative mt-5 flex items-center gap-4 rounded-2xl bg-canvas-soft p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-mint-soft text-brand-mint-strong">
                <BadgeCheck aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">Your wallet is ready</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Every entry is recorded in your activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="tokenly-highlights"
        className="pb-10 sm:pb-16 lg:pb-24"
      >
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-brand-blue-strong uppercase">
              Made for the event floor
            </p>
            <h2
              id="tokenly-highlights"
              className="mt-2 text-2xl font-bold tracking-[-0.025em] text-ink sm:text-3xl"
            >
              Less tapping. More enjoying.
            </h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ title, description, icon: Icon, colour }) => (
            <article
              key={title}
              className="rounded-card bg-white/78 p-5 shadow-soft ring-1 ring-white/80 backdrop-blur sm:p-6"
            >
              <span
                className={`grid size-12 place-items-center rounded-2xl ${colour}`}
              >
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 leading-7 text-ink-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
