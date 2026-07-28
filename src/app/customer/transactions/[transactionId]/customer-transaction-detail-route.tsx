"use client";

import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { createConfiguredCustomerPortalQuery } from "@/config/configured-customer-portal-query";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerResourceError,
  CustomerResourceLoading,
  CustomerTransactionDetailScreen,
  useCustomerResource,
} from "@/modules/customer-application";

export function CustomerTransactionDetailRoute({
  transactionId,
  showReceipt,
}: Readonly<{
  transactionId: string;
  showReceipt: boolean;
}>) {
  const runtime = useTokenlyRuntime();
  const query = useMemo(() => createConfiguredCustomerPortalQuery(), []);
  const accountId = runtime.session?.account.id ?? "";
  const loadDetail = useCallback(
    () => query.getTransactionDetail(accountId, transactionId),
    [accountId, query, transactionId],
  );
  const resource = useCustomerResource(loadDetail);

  if (resource.state.status === "loading") {
    return <CustomerResourceLoading label="Loading transaction details…" />;
  }

  if (resource.state.status === "error") {
    return (
      <div className="space-y-4">
        <Link
          href="/customer/transactions"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to activity
        </Link>
        <CustomerResourceError
          onRetry={resource.retry}
          title="Transaction details could not load"
        />
        <p className="sr-only">
          <SearchX aria-hidden="true" />
          The transaction may no longer be available for this customer.
        </p>
      </div>
    );
  }

  return (
    <CustomerTransactionDetailScreen
      detail={resource.state.data}
      showReceipt={showReceipt}
    />
  );
}
