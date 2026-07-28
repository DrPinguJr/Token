"use client";

import {
  Banknote,
  Camera,
  CircleHelp,
  Database,
  FlaskConical,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { EventHelpReadModel } from "../event-help-query";

export interface EventHelpScreenProps {
  readonly loadHelp: () => Promise<EventHelpReadModel>;
}

type EventHelpState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly value: EventHelpReadModel };

export function EventHelpScreen({ loadHelp }: EventHelpScreenProps) {
  const [state, setState] = useState<EventHelpState>({ status: "loading" });
  const [retryGeneration, setRetryGeneration] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void loadHelp()
      .then((value) => {
        if (isCurrent) {
          setState({ status: "ready", value });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setState({ status: "error" });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [loadHelp, retryGeneration]);

  const help = state.status === "ready" ? state.value : null;

  return (
    <div className="mx-auto w-full max-w-5xl pb-16 pt-8 sm:pt-12">
      <header className="max-w-3xl">
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue-strong uppercase">
          Help and support
        </p>
        <h1 className="mt-3 text-4xl font-bold text-balance text-ink sm:text-5xl">
          Tokenly, without the mystery
        </h1>
        <p className="mt-4 text-lg leading-8 text-ink-muted">
          This build is a complete local prototype for an event token wallet.
          It is not connected to banks, PayNow, SMS, or production services.
        </p>
      </header>

      {state.status === "loading" && (
        <p
          role="status"
          className="mt-6 w-fit rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
        >
          Loading event support details…
        </p>
      )}

      {state.status === "error" && (
        <div className="mt-6 rounded-card bg-brand-pink-soft p-5">
          <p role="alert" className="font-medium text-danger">
            Event-specific support details could not be loaded. The general
            prototype guidance below is still available.
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setRetryGeneration((generation) => generation + 1);
            }}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Reload support details
          </button>
        </div>
      )}

      {help?.event !== null && help?.event !== undefined && (
        <section className="mt-8 rounded-card bg-ink p-6 text-white shadow-raised sm:p-8">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-blue uppercase">
            Current local event
          </p>
          <h2 className="mt-2 text-2xl font-bold">{help.event.name}</h2>
          <p className="mt-2 text-white/75">{help.event.venue}</p>
        </section>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <HelpCard
          icon={<Database aria-hidden="true" className="size-5" />}
          title="Local prototype data"
        >
          <p>
            Application records are stored in this browser with IndexedDB.
            Clearing site data or using the development reset removes local
            records. Nothing here should be treated as a production payment or
            payout record.
          </p>
        </HelpCard>

        <HelpCard
          icon={<Banknote aria-hidden="true" className="size-5" />}
          title="Adding tokens and PayNow"
        >
          <p>
            PayNow checks are manual. Event staff visually checks payment
            evidence before recording tokens; Tokenly does not connect to
            PayNow, verify a bank payment, or move money.
          </p>
        </HelpCard>

        <HelpCard
          icon={<ShieldCheck aria-hidden="true" className="size-5" />}
          title="Purchases and refunds"
        >
          <p>
            Vendors can record full or partial refunds against eligible local
            orders. If a purchase or wallet record looks wrong, keep its
            reference and contact event support before trying again.
          </p>
        </HelpCard>

        <HelpCard
          icon={<Camera aria-hidden="true" className="size-5" />}
          title="Camera and QR privacy"
        >
          <p>
            Camera access is requested only after you allow it. QR frames are
            processed in the browser and are not saved or uploaded. If scanning
            is denied or unsupported, enter the opaque vendor code beginning
            with vnd_.
          </p>
        </HelpCard>
      </div>

      <section
        aria-labelledby="event-support-heading"
        className="mt-8 rounded-card bg-white p-6 shadow-soft sm:p-8"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-mint-soft text-brand-mint-strong">
            <CircleHelp aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2
              id="event-support-heading"
              className="text-xl font-bold text-ink"
            >
              {help?.support?.label ?? "Event support"}
            </h2>
            {help?.support === null || help?.support === undefined ? (
              <p className="mt-2 leading-7 text-ink-muted">
                Event-specific contact details are unavailable. Visit the event
                help desk for wallet, purchase, or refund assistance.
              </p>
            ) : (
              <>
                <p className="mt-2 font-semibold text-ink">
                  {help.support.contact}
                </p>
                <p className="mt-2 leading-7 text-ink-muted">
                  {help.support.instructions}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {help?.developmentAccess !== null &&
        help?.developmentAccess !== undefined && (
          <section
            aria-labelledby="development-access-heading"
            className="mt-8 rounded-card border border-dashed border-brand-pink-strong/35 bg-brand-pink-soft/60 p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-pink-strong shadow-soft">
                <FlaskConical aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-[0.18em] text-brand-pink-strong uppercase">
                  Development tools enabled
                </p>
                <h2
                  id="development-access-heading"
                  className="mt-1 text-xl font-bold text-ink"
                >
                  Fictional test accounts
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  These credentials work only with the deterministic local
                  seed. The development wallet PIN is{" "}
                  <strong className="font-mono text-ink">
                    {help.developmentAccess.pin}
                  </strong>
                  .
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {help.developmentAccess.accounts.map((account) => (
                    <li
                      key={`${account.role}-${account.mobileNumber}`}
                      className="rounded-2xl bg-white px-4 py-3 shadow-soft"
                    >
                      <span className="block text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">
                        {account.role}
                      </span>
                      <span className="mt-1 block font-mono font-semibold text-ink">
                        {account.mobileNumber}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
    </div>
  );
}

interface HelpCardProps {
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly title: string;
}

function HelpCard({ children, icon, title }: HelpCardProps) {
  return (
    <section className="rounded-card bg-white p-6 shadow-soft">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-bold text-ink">{title}</h2>
      <div className="mt-2 leading-7 text-ink-muted">{children}</div>
    </section>
  );
}
