"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerAccessService } from "@/config/configured-customer-access";
import { ClaimAccountScreen } from "@/modules/customer-access";

export function ClaimAccountRoute({
  claimCode,
}: Readonly<{ claimCode: string }>) {
  const service = useMemo(() => createConfiguredCustomerAccessService(), []);
  const claim = useCallback((input: string) => service.claim(input), [service]);

  return <ClaimAccountScreen claimCode={claimCode} claim={claim} />;
}
