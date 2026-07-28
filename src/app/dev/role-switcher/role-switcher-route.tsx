"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  DevelopmentAccountQueryDisabledError,
  DevelopmentRoleSwitcher,
  type DevelopmentAccountReadModel,
} from "@/modules/development-tools";

interface AccountLoadState {
  readonly accounts: readonly DevelopmentAccountReadModel[];
  readonly errorMessage: string | null;
  readonly status: "loading" | "ready";
}

export function DevelopmentRoleSwitcherRoute() {
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const listDevelopmentAccounts = runtime.listDevelopmentAccounts;
  const switchDevelopmentAccount = runtime.switchDevelopmentAccount;
  const [accountLoad, setAccountLoad] = useState<AccountLoadState>({
    accounts: [],
    errorMessage: null,
    status: "loading",
  });

  useEffect(() => {
    if (runtime.status !== "ready") {
      return;
    }

    let isCurrent = true;

    void (async () => {
      try {
        const activeAccounts = await listDevelopmentAccounts();

        if (isCurrent) {
          setAccountLoad({
            accounts: activeAccounts,
            errorMessage: null,
            status: "ready",
          });
        }
      } catch (error: unknown) {
        if (isCurrent) {
          setAccountLoad({
            accounts: [],
            errorMessage:
              error instanceof DevelopmentAccountQueryDisabledError
                ? error.message
                : "Seeded accounts could not be loaded.",
            status: "ready",
          });
        }
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [listDevelopmentAccounts, runtime.status]);

  async function switchAccount(accountId: string): Promise<void> {
    const nextSession = await switchDevelopmentAccount(accountId);
    router.push(nextSession.destination);
  }

  if (runtime.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-card bg-brand-pink-soft p-6 font-medium text-danger shadow-soft"
      >
        {runtime.errorMessage ?? "The local account runtime is unavailable."}
      </p>
    );
  }

  if (runtime.status === "loading" || accountLoad.status === "loading") {
    return (
      <p
        role="status"
        className="rounded-card bg-white p-6 text-ink-muted shadow-soft"
      >
        Loading seeded accounts…
      </p>
    );
  }

  if (accountLoad.errorMessage !== null) {
    return (
      <p
        role="alert"
        className="rounded-card bg-brand-pink-soft p-6 font-medium text-danger shadow-soft"
      >
        {accountLoad.errorMessage}
      </p>
    );
  }

  return (
    <DevelopmentRoleSwitcher
      accounts={accountLoad.accounts}
      currentAccountId={runtime.session?.account.id ?? null}
      onSwitch={switchAccount}
    />
  );
}
