"use client";

import { useCallback } from "react";

import {
  adjustRemoteTokenerTokens,
  createRemoteTokener,
  loadRemoteTokeners,
  refreshRemoteClaimQr,
} from "@/config/remote-customer-access-client";
import { AdminTokenersScreen } from "@/modules/customer-access";

export function AdminTokenersRoute({
  selectedCustomerId,
}: Readonly<{ selectedCustomerId?: string }>) {
  const refreshClaimQr = useCallback(async (customerId: string) => {
    await refreshRemoteClaimQr(customerId);
  }, []);

  return (
    <AdminTokenersScreen
      adjustTokenerTokens={adjustRemoteTokenerTokens}
      createTokener={createRemoteTokener}
      loadTokeners={loadRemoteTokeners}
      refreshClaimQr={refreshClaimQr}
      selectedCustomerId={selectedCustomerId}
    />
  );
}
