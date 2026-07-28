"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerCommerceGateway } from "@/config/configured-customer-commerce";
import { VendorDirectory } from "@/modules/customer-commerce";

export function CustomerVendorsRoute() {
  const commerce = useMemo(createConfiguredCustomerCommerceGateway, []);
  const loadVendors = useCallback(
    () => commerce.listVendorDirectory(),
    [commerce],
  );

  return <VendorDirectory loadVendors={loadVendors} />;
}
