import type { PinChangeResult } from "@/modules/authentication";

import { createLocalPinVerificationService } from "./local-pin-verification-service";

export interface CustomerPinChangeCapability {
  readonly changePin: (
    actorAccountId: string,
    currentPin: string,
    newPin: string,
  ) => Promise<PinChangeResult>;
}

/**
 * Exposes only the customer PIN-change capability needed by the wallet UI.
 * Credential repositories remain confined to PinVerificationService.
 */
export function createConfiguredCustomerPinChangeCapability(): CustomerPinChangeCapability {
  const service = createLocalPinVerificationService();

  return Object.freeze({
    changePin(
      actorAccountId: string,
      currentPin: string,
      newPin: string,
    ): Promise<PinChangeResult> {
      return service.changePin({
        actorAccountId,
        currentPin,
        newPin,
      });
    },
  });
}
