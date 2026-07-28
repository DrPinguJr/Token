import type { Metadata } from "next";

import { PublicShell } from "@/shared/components/public-shell";

import { HelpPageClient } from "./help-page-client";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Local prototype guidance for Tokenly wallets, purchases, refunds, QR privacy, and event support.",
};

export default function HelpPage() {
  return (
    <PublicShell>
      <HelpPageClient />
    </PublicShell>
  );
}
