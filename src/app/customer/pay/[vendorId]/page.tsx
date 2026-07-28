import type { Metadata } from "next";

import { CustomerPaymentRoute } from "./customer-payment-route";

export const metadata: Metadata = {
  title: "Review purchase",
  description: "Review a basket and confirm a local token payment.",
};

interface CustomerPaymentPageProps {
  readonly params: Promise<{
    vendorId: string;
  }>;
}

export default async function CustomerPaymentPage({
  params,
}: CustomerPaymentPageProps) {
  const { vendorId } = await params;

  return <CustomerPaymentRoute vendorId={vendorId} />;
}
