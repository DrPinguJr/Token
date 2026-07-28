import type { Metadata } from "next";

import { CustomerAccountQrRoute } from "./customer-account-qr-route";

export const metadata: Metadata = {
  title: "My account QR",
  description: "Show an opaque Tokenly customer account code.",
};

export default function CustomerAccountQrPage() {
  return <CustomerAccountQrRoute />;
}
