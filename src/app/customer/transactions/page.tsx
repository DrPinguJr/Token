import type { Metadata } from "next";

import { CustomerTransactionsRoute } from "./customer-transactions-route";

export const metadata: Metadata = {
  title: "Activity",
};

export default function CustomerTransactionsPage() {
  return <CustomerTransactionsRoute />;
}
