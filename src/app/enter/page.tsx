import type { Metadata } from "next";

import { PublicShell } from "@/shared/components/public-shell";

import { EnterPageClient } from "./enter-page-client";

export const metadata: Metadata = {
  title: "Enter",
  description: "Sign in to the local Tokenly super-admin account.",
};

export default function EnterPage() {
  return (
    <PublicShell>
      <EnterPageClient />
    </PublicShell>
  );
}
