"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerPortalQuery } from "@/config/configured-customer-portal-query";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerResourceError,
  CustomerResourceLoading,
  CustomerTransactionHistoryScreen,
  useCustomerResource,
} from "@/modules/customer-application";

export function CustomerTransactionsRoute() {
  const runtime = useTokenlyRuntime();
  const query = useMemo(() => createConfiguredCustomerPortalQuery(), []);
  const accountId = runtime.session?.account.id ?? "";
  const loadTransactions = useCallback(
    () => query.listTransactions(accountId),
    [accountId, query],
  );
  const resource = useCustomerResource(loadTransactions);

  if (resource.state.status === "loading") {
    return <CustomerResourceLoading label="Loading your activity…" />;
  }

  if (resource.state.status === "error") {
    return (
      <CustomerResourceError
        onRetry={resource.retry}
        title="Your activity could not load"
      />
    );
  }

  return <CustomerTransactionHistoryScreen history={resource.state.data} />;
}
