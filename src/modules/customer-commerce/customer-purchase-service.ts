import type {
  PinVerificationResult,
  PinVerificationService,
} from "@/modules/authentication";
import {
  PurchaseServiceError,
  type PurchaseAuthorizationCallback,
  type PurchaseReceipt,
  type PurchaseService,
} from "@/modules/orders";

import { CustomerCommerceError } from "./customer-commerce-error";
import { customerPurchaseInputSchema } from "./customer-commerce-schema";

export interface CustomerPurchaseServiceDependencies {
  readonly pinVerificationService: Pick<PinVerificationService, "verifyPin">;
  readonly purchaseService: Pick<PurchaseService, "completePurchase">;
}

function translatePurchaseError(error: PurchaseServiceError): never {
  switch (error.code) {
    case "PURCHASE_INSUFFICIENT_BALANCE":
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_INSUFFICIENT_BALANCE");
    case "PURCHASE_DUPLICATE_SUBMISSION":
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_DUPLICATE");
    case "PURCHASE_VENDOR_CLOSED":
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_VENDOR_CLOSED");
    case "PURCHASE_PRODUCT_UNAVAILABLE":
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_PRODUCT_UNAVAILABLE");
    case "PURCHASE_INVALID_COMMAND":
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_INVALID");
    default:
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_UNAVAILABLE");
  }
}

function assertVerifiedAuthorization(
  result: PinVerificationResult,
  actorAccountId: string,
): void {
  if (result.status === "locked") {
    throw new CustomerCommerceError("CUSTOMER_PURCHASE_PIN_LOCKED", {
      lockedUntil: result.lockedUntil,
    });
  }

  if (result.status !== "verified" || result.accountId !== actorAccountId) {
    throw new CustomerCommerceError("CUSTOMER_PURCHASE_PIN_FAILED");
  }
}

/**
 * Customer-facing purchase boundary.
 *
 * The PIN is parsed here, captured by exactly one authorization callback, and
 * excluded from the PurchaseService command and every persisted record.
 */
export class CustomerPurchaseService {
  public constructor(
    private readonly dependencies: CustomerPurchaseServiceDependencies,
  ) {}

  public async completePurchase(input: unknown): Promise<PurchaseReceipt> {
    const parsedInput = customerPurchaseInputSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new CustomerCommerceError("CUSTOMER_PURCHASE_INVALID");
    }

    const { pin, ...purchaseCommand } = parsedInput.data;
    let authorizationAttempted = false;

    const authorize: PurchaseAuthorizationCallback = async (request) => {
      if (
        authorizationAttempted ||
        request.actorAccountId !== purchaseCommand.actorAccountId ||
        request.customerId !== purchaseCommand.customerId ||
        request.vendorId !== purchaseCommand.vendorId
      ) {
        throw new CustomerCommerceError(
          "CUSTOMER_PURCHASE_AUTHORIZATION_INVALID",
        );
      }

      authorizationAttempted = true;
      const result = await this.dependencies.pinVerificationService.verifyPin({
        actorAccountId: request.actorAccountId,
        pin,
      });
      assertVerifiedAuthorization(result, request.actorAccountId);
    };

    try {
      return await this.dependencies.purchaseService.completePurchase(
        purchaseCommand,
        authorize,
      );
    } catch (error: unknown) {
      if (error instanceof CustomerCommerceError) {
        throw error;
      }

      if (error instanceof PurchaseServiceError) {
        translatePurchaseError(error);
      }

      throw error;
    }
  }
}
