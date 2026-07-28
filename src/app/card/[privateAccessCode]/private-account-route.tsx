"use client";

import {
  loadRemotePrivateAccount,
  regenerateRemoteWalletQr,
} from "@/config/remote-customer-access-client";
import { PrivateAccountScreen } from "@/modules/customer-access";

export function PrivateAccountRoute({
  privateAccessCode,
}: Readonly<{ privateAccessCode: string }>) {
  return (
    <PrivateAccountScreen
      privateAccessCode={privateAccessCode}
      loadAccount={loadRemotePrivateAccount}
      regenerateWalletQr={regenerateRemoteWalletQr}
    />
  );
}
