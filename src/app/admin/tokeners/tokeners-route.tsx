"use client";

import { useCallback, useMemo } from "react";

import {
  createConfiguredCustomerAccessQuery,
  createConfiguredCustomerAccessService,
} from "@/config/configured-customer-access";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { AdminTokenersScreen } from "@/modules/customer-access";

export function AdminTokenersRoute({
  selectedCustomerId,
}: Readonly<{ selectedCustomerId?: string }>) {
  const runtime = useTokenlyRuntime();
  const query = useMemo(() => createConfiguredCustomerAccessQuery(), []);
  const service = useMemo(() => createConfiguredCustomerAccessService(), []);
  const accountId = runtime.session?.account.id ?? "";
  const loadTokeners = useCallback(
    () => query.listForAdmin(accountId),
    [accountId, query],
  );
  const refreshClaimQr = useCallback(
    async (customerId: string) => {
      await service.refreshClaimQr(accountId, customerId);
    },
    [accountId, service],
  );

  return (
    <AdminTokenersScreen
      loadTokeners={loadTokeners}
      refreshClaimQr={refreshClaimQr}
      selectedCustomerId={selectedCustomerId}
    />
  );
}
