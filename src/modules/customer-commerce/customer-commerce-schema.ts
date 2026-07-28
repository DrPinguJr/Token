import { z } from "zod";

import { walletPinSchema } from "@/modules/authentication";
import { walletOperationIdempotencyKeySchema } from "@/modules/transactions";
import {
  domainIdSchema,
  positiveSafeIntegerSchema,
} from "@/shared/validation";

export const customerBasketItemSchema = z
  .object({
    productId: domainIdSchema,
    quantity: positiveSafeIntegerSchema,
  })
  .strict();

const uniqueCustomerBasketItemsSchema = z
  .array(customerBasketItemSchema)
  .max(100)
  .superRefine((items, context) => {
    const productIds = new Set<string>();

    items.forEach((item, index) => {
      if (productIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          message: "Each basket product may appear only once.",
          path: [index, "productId"],
        });
      }

      productIds.add(item.productId);
    });
  });

export const customerBasketSnapshotSchema = z
  .object({
    version: z.literal(1),
    actorAccountId: domainIdSchema,
    vendorId: domainIdSchema,
    idempotencyKey: walletOperationIdempotencyKeySchema,
    items: uniqueCustomerBasketItemsSchema,
  })
  .strict();

export const customerStorefrontQuerySchema = z
  .object({
    vendorId: domainIdSchema,
  })
  .strict();

export const customerPaymentReviewQuerySchema = z
  .object({
    actorAccountId: domainIdSchema,
    vendorId: domainIdSchema,
    items: uniqueCustomerBasketItemsSchema.min(1),
  })
  .strict();

export const customerPurchaseInputSchema =
  customerPaymentReviewQuerySchema.extend({
    customerId: domainIdSchema,
    idempotencyKey: walletOperationIdempotencyKeySchema,
    pin: walletPinSchema,
  });

export type CustomerBasketItem = Readonly<
  z.infer<typeof customerBasketItemSchema>
>;
type ParsedCustomerBasketSnapshot = z.infer<
  typeof customerBasketSnapshotSchema
>;
export type CustomerBasketSnapshot = Readonly<
  Omit<ParsedCustomerBasketSnapshot, "items"> & {
    readonly items: readonly CustomerBasketItem[];
  }
>;
export type CustomerStorefrontQueryInput = Readonly<
  z.infer<typeof customerStorefrontQuerySchema>
>;
type ParsedCustomerPaymentReviewQueryInput = z.infer<
  typeof customerPaymentReviewQuerySchema
>;
export type CustomerPaymentReviewQueryInput = Readonly<
  Omit<ParsedCustomerPaymentReviewQueryInput, "items"> & {
    readonly items: readonly CustomerBasketItem[];
  }
>;
type ParsedCustomerPurchaseInput = z.infer<typeof customerPurchaseInputSchema>;
export type CustomerPurchaseInput = Readonly<
  Omit<ParsedCustomerPurchaseInput, "items"> & {
    readonly items: readonly CustomerBasketItem[];
  }
>;
