import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { customerTransactionRouteInputSchema } from "@/modules/customer-application";

import { CustomerTransactionDetailRoute } from "./customer-transaction-detail-route";

export const metadata: Metadata = {
  title: "Transaction details",
};

type CustomerTransactionDetailPageProps = Readonly<{
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ receipt?: string | readonly string[] }>;
}>;

export default async function CustomerTransactionDetailPage({
  params,
  searchParams,
}: CustomerTransactionDetailPageProps) {
  const [{ transactionId }, query] = await Promise.all([params, searchParams]);
  const parsedRoute = customerTransactionRouteInputSchema.safeParse({
    transactionId,
    receipt: query.receipt,
  });

  if (!parsedRoute.success) {
    notFound();
  }

  return (
    <CustomerTransactionDetailRoute
      transactionId={parsedRoute.data.transactionId}
      showReceipt={parsedRoute.data.receipt}
    />
  );
}
