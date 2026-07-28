import type { Metadata } from "next";

import { CustomerWalletRoute } from "./customer-wallet-route";

export const metadata: Metadata = {
  title: "Wallet",
};

export default function CustomerWalletPage() {
  return <CustomerWalletRoute />;
}
