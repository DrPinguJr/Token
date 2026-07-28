import type { Metadata } from "next";

import { PublicShell } from "@/shared/components/public-shell";

import { EnterPageClient } from "./enter-page-client";

export const metadata: Metadata = {
  title: "Enter",
  description:
    "Enter a fictional local Tokenly account with its seeded mobile number.",
};

export default function EnterPage() {
  return (
    <PublicShell>
      <EnterPageClient />
    </PublicShell>
  );
}
