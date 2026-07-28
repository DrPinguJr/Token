import type { Metadata } from "next";

import { CustomerVendorStorefrontRoute } from "./customer-vendor-storefront-route";

export const metadata: Metadata = {
  title: "Vendor storefront",
  description: "Browse current products and build a Tokenly basket.",
};

interface CustomerVendorStorefrontPageProps {
  readonly params: Promise<{
    vendorId: string;
  }>;
}

export default async function CustomerVendorStorefrontPage({
  params,
}: CustomerVendorStorefrontPageProps) {
  const { vendorId } = await params;

  return <CustomerVendorStorefrontRoute vendorId={vendorId} />;
}
