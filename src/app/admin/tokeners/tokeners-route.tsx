"use client";

import { useCallback } from "react";

import {
  addRemoteTokenerCredits,
  createRemoteTokener,
  loadRemoteTokenerDetail,
  loadRemoteTokeners,
  refreshRemoteClaimQr,
  refundRemoteTokenerTransaction,
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
      addTokenerCredits={addRemoteTokenerCredits}
      createTokener={createRemoteTokener}
      loadTokenerDetail={loadRemoteTokenerDetail}
      loadTokeners={loadRemoteTokeners}
      refreshClaimQr={refreshClaimQr}
      refundTokenerTransaction={refundRemoteTokenerTransaction}
      selectedCustomerId={selectedCustomerId}
    />
  );
}
