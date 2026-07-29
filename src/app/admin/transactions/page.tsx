import type { Metadata } from "next";

import { AdminTransactionsRoute } from "./admin-transactions-route";

export const metadata: Metadata = {
  title: "Admin transactions",
};

export default function AdminTransactionsPage() {
  return <AdminTransactionsRoute />;
}
