"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerPortalQuery } from "@/config/configured-customer-portal-query";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerHomeScreen,
  CustomerResourceError,
  CustomerResourceLoading,
  useCustomerResource,
} from "@/modules/customer-application";

export function CustomerHomeRoute() {
  const runtime = useTokenlyRuntime();
  const query = useMemo(() => createConfiguredCustomerPortalQuery(), []);
  const accountId = runtime.session?.account.id ?? "";
  const loadHome = useCallback(
    () => query.getHome(accountId),
    [accountId, query],
  );
  const resource = useCustomerResource(loadHome);

  if (resource.state.status === "loading") {
    return <CustomerResourceLoading />;
  }

  if (resource.state.status === "error") {
    return <CustomerResourceError onRetry={resource.retry} />;
  }

  return <CustomerHomeScreen home={resource.state.data} />;
}
