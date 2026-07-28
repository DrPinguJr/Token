import type { Metadata } from "next";

import { CustomerVendorsRoute } from "./customer-vendors-route";

export const metadata: Metadata = {
  title: "Vendors",
  description: "Browse local event vendor storefronts and products.",
};

export default function CustomerVendorsPage() {
  return <CustomerVendorsRoute />;
}
