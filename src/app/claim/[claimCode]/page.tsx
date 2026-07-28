import type { Metadata } from "next";

import { ClaimAccountRoute } from "./claim-account-route";

export const metadata: Metadata = {
  title: "Claim Tokenly account",
};

interface ClaimAccountPageProps {
  readonly params: Promise<{
    claimCode: string;
  }>;
}

export default async function ClaimAccountPage({
  params,
}: ClaimAccountPageProps) {
  const { claimCode } = await params;

  return <ClaimAccountRoute claimCode={claimCode} />;
}
