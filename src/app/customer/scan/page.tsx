import type { Metadata } from "next";

import { CustomerScanRoute } from "./customer-scan-route";

export const metadata: Metadata = {
  title: "Scan vendor",
  description:
    "Scan a Tokenly vendor QR or enter an opaque vendor code manually.",
};

export default function CustomerScanPage() {
  return <CustomerScanRoute />;
}
