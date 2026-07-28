"use client";

import { ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import { useState } from "react";

import type { AccountRole } from "@/modules/accounts";

import type { DevelopmentAccountReadModel } from "../development-account-query";

const roleLabels = {
  administrator: "Administrator",
  customer: "Customer",
  staff: "Event staff",
  vendor: "Vendor",
} as const satisfies Record<AccountRole, string>;

export interface DevelopmentRoleSwitcherProps {
  readonly accounts: readonly DevelopmentAccountReadModel[];
  readonly currentAccountId: string | null;
  readonly onSwitch: (accountId: string) => Promise<void>;
}

function getSwitchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The development session could not be switched.";
}

export function DevelopmentRoleSwitcher({
  accounts,
  currentAccountId,
  onSwitch,
}: DevelopmentRoleSwitcherProps) {
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function switchAccount(accountId: string): Promise<void> {
    setErrorMessage(null);
    setSwitchingAccountId(accountId);

    try {
      await onSwitch(accountId);
    } catch (error: unknown) {
      setErrorMessage(getSwitchErrorMessage(error));
      setSwitchingAccountId(null);
    }
  }

  return (
    <section aria-labelledby="development-role-switcher-heading">
      <div className="rounded-card bg-brand-pink-soft p-4 text-ink shadow-soft sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-pink-strong">
            <FlaskConical aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-bold">Development simulator</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Switching here creates the same local session shape as normal
              account entry. No identity is verified.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.12em] text-brand-blue-strong uppercase">
            Seeded accounts
          </p>
          <h1
            id="development-role-switcher-heading"
            className="mt-2 text-3xl font-bold tracking-[-0.035em] text-ink"
          >
            Choose a local role
          </h1>
        </div>
        <p className="hidden text-sm text-ink-muted sm:block">
          {accounts.length} accounts
        </p>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {errorMessage}
        </p>
      )}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {accounts.map((account) => {
          const isCurrent = account.id === currentAccountId;
          const isSwitching = switchingAccountId === account.id;

          return (
            <li
              key={account.id}
              className="rounded-card bg-white p-5 shadow-soft ring-1 ring-ink/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-blue-strong">
                    {roleLabels[account.role]}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-bold text-ink">
                    {account.displayName}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-ink-muted">
                    {account.mobileNumber}
                  </p>
                </div>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-mint-soft px-3 py-1.5 text-xs font-semibold text-brand-mint-strong">
                    <CheckCircle2 aria-hidden="true" className="size-3.5" />
                    Current
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={switchingAccountId !== null || isCurrent}
                onClick={() => void switchAccount(account.id)}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCurrent
                  ? "Active session"
                  : isSwitching
                    ? "Switching…"
                    : "Use this account"}
                {!isCurrent && !isSwitching && (
                  <ArrowRight aria-hidden="true" className="size-5" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
