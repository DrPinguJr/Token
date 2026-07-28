"use client";

import { useCallback, useMemo } from "react";

import { createConfiguredCustomerPinChangeCapability } from "@/config/configured-customer-pin-change";
import { createConfiguredCustomerPortalQuery } from "@/config/configured-customer-portal-query";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  CustomerResourceError,
  CustomerResourceLoading,
  CustomerWalletScreen,
  useCustomerResource,
} from "@/modules/customer-application";

export function CustomerWalletRoute() {
  const runtime = useTokenlyRuntime();
  const query = useMemo(() => createConfiguredCustomerPortalQuery(), []);
  const pinCapability = useMemo(
    () => createConfiguredCustomerPinChangeCapability(),
    [],
  );
  const accountId = runtime.session?.account.id ?? "";
  const loadWallet = useCallback(
    () => query.getWallet(accountId),
    [accountId, query],
  );
  const changePin = useCallback(
    (currentPin: string, newPin: string) =>
      pinCapability.changePin(accountId, currentPin, newPin),
    [accountId, pinCapability],
  );
  const resource = useCustomerResource(loadWallet);

  if (resource.state.status === "loading") {
    return <CustomerResourceLoading label="Loading your wallet activity…" />;
  }

  if (resource.state.status === "error") {
    return (
      <CustomerResourceError
        onRetry={resource.retry}
        title="Your wallet could not load"
      />
    );
  }

  return (
    <CustomerWalletScreen
      walletPage={resource.state.data}
      onChangePin={changePin}
    />
  );
}
