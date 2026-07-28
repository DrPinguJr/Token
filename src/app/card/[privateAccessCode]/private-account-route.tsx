"use client";

import { useCallback, useMemo } from "react";

import {
  createConfiguredCustomerAccessQuery,
  createConfiguredCustomerAccessService,
} from "@/config/configured-customer-access";
import { PrivateAccountScreen } from "@/modules/customer-access";

export function PrivateAccountRoute({
  privateAccessCode,
}: Readonly<{ privateAccessCode: string }>) {
  const query = useMemo(() => createConfiguredCustomerAccessQuery(), []);
  const service = useMemo(() => createConfiguredCustomerAccessService(), []);
  const loadAccount = useCallback(
    (input: string) => query.getPrivateAccount(input),
    [query],
  );
  const regenerateWalletQr = useCallback(
    async (input: string) => {
      await service.regenerateWalletQr(input);
    },
    [service],
  );

  return (
    <PrivateAccountScreen
      privateAccessCode={privateAccessCode}
      loadAccount={loadAccount}
      regenerateWalletQr={regenerateWalletQr}
    />
  );
}
