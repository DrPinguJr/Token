"use client";

import { claimRemoteTokener } from "@/config/remote-customer-access-client";
import { ClaimAccountScreen } from "@/modules/customer-access";

export function ClaimAccountRoute({
  claimCode,
}: Readonly<{ claimCode: string }>) {
  return (
    <ClaimAccountScreen claimCode={claimCode} claim={claimRemoteTokener} />
  );
}
