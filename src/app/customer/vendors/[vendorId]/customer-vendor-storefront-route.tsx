"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerCommerceGateway } from "@/config/configured-customer-commerce";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerBasketProvider,
  CustomerCommerceErrorState,
  VendorStorefront,
} from "@/modules/customer-commerce";

export interface CustomerVendorStorefrontRouteProps {
  readonly vendorId: string;
}

export function CustomerVendorStorefrontRoute({
  vendorId,
}: CustomerVendorStorefrontRouteProps) {
  const runtime = useTokenlyRuntime();
  const commerce = useMemo(() => createConfiguredCustomerCommerceGateway(), []);
  const loadStorefront = useCallback(
    (requestedVendorId: string) =>
      commerce.getVendorStorefront(requestedVendorId),
    [commerce],
  );
  const actorAccountId = runtime.session?.account.id;

  if (actorAccountId === undefined) {
    return (
      <CustomerCommerceErrorState
        title="Customer session unavailable"
        message="Return to account entry before opening this storefront."
      />
    );
  }

  return (
    <CustomerBasketProvider actorAccountId={actorAccountId} vendorId={vendorId}>
      <VendorStorefront vendorId={vendorId} loadStorefront={loadStorefront} />
    </CustomerBasketProvider>
  );
}
