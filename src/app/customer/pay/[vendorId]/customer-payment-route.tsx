"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { createConfiguredCustomerCommerceGateway } from "@/config/configured-customer-commerce";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerBasketProvider,
  CustomerCommerceErrorState,
  CustomerPaymentReview,
} from "@/modules/customer-commerce";
import type { PurchaseReceipt } from "@/modules/orders";

export interface CustomerPaymentRouteProps {
  readonly vendorId: string;
}

export function CustomerPaymentRoute({
  vendorId,
}: CustomerPaymentRouteProps) {
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const commerce = useMemo(createConfiguredCustomerCommerceGateway, []);
  const loadReview = useCallback(
    (input: Parameters<typeof commerce.getPaymentReview>[0]) =>
      commerce.getPaymentReview(input),
    [commerce],
  );
  const completePurchase = useCallback(
    (input: Parameters<typeof commerce.completePurchase>[0]) =>
      commerce.completePurchase(input),
    [commerce],
  );
  const openReceipt = useCallback(
    (receipt: PurchaseReceipt) => {
      router.push(
        `/customer/transactions/${encodeURIComponent(receipt.orderId)}?receipt=1`,
      );
    },
    [router],
  );
  const actorAccountId = runtime.session?.account.id;
  const customerId = runtime.session?.customer?.id;

  if (actorAccountId === undefined || customerId === undefined) {
    return (
      <CustomerCommerceErrorState
        title="Customer session unavailable"
        message="Return to account entry before reviewing this payment."
      />
    );
  }

  return (
    <CustomerBasketProvider
      actorAccountId={actorAccountId}
      vendorId={vendorId}
    >
      <CustomerPaymentReview
        actorAccountId={actorAccountId}
        customerId={customerId}
        vendorId={vendorId}
        loadReview={loadReview}
        completePurchase={completePurchase}
        onReceipt={openReceipt}
      />
    </CustomerBasketProvider>
  );
}
