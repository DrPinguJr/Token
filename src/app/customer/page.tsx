import type { Metadata } from "next";

import { CustomerHomeRoute } from "./customer-home-route";

export const metadata: Metadata = {
  title: "Customer home",
};

export default function CustomerHomePage() {
  return <CustomerHomeRoute />;
}
