import type { Metadata } from "next";

import { EnterPageClient } from "./enter-page-client";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in or scan a Tokenly access QR.",
};

export default function EnterPage() {
  return <EnterPageClient />;
}
