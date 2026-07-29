"use client";

import { useCallback } from "react";

import { loadRemoteAdminTransactions } from "@/config/remote-customer-access-client";
import { AdminTransactionsScreen } from "@/modules/admin-application";

export function AdminTransactionsRoute() {
  const loadOverview = useCallback(() => loadRemoteAdminTransactions(), []);

  return <AdminTransactionsScreen loadOverview={loadOverview} />;
}
