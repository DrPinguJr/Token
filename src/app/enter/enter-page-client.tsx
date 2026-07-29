"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { establishPrototypeSession } from "@/config/remote-customer-access-client";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  AccountEntryScreen,
  type AccountEntryInput,
} from "@/modules/authentication";

import { EnterQrMode } from "./enter-qr-mode";

export function EnterPageClient() {
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const runtimeEnterAccount = runtime.enterAccount;

  useEffect(() => {
    if (runtime.status === "ready" && runtime.session !== null) {
      router.replace(runtime.session.destination);
    }
  }, [router, runtime.session, runtime.status]);

  const enterAccount = useCallback(
    async (input: AccountEntryInput): Promise<void> => {
      const session = await runtimeEnterAccount(input);
      if (
        session.account.role === "administrator" ||
        session.account.role === "vendor"
      ) {
        await establishPrototypeSession(input);
      }
      router.replace(session.destination);
    },
    [router, runtimeEnterAccount],
  );

  return (
    <AccountEntryScreen
      runtimeStatus={runtime.status}
      runtimeErrorMessage={runtime.errorMessage}
      onEnter={enterAccount}
      onRetry={runtime.reloadRuntime}
      qrMode={<EnterQrMode />}
    />
  );
}
