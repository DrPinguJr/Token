import { z } from "zod";

import {
  domainIdSchema,
  idempotencyKeySchema,
  nonBlankTextSchema,
  nonNegativeSafeIntegerSchema,
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

export const orderStatusSchema = z.literal("completed");

export const orderItemSchema = z
  .object({
    productId: domainIdSchema,
    productName: nonBlankTextSchema.max(160),
    unitTokenPrice: positiveSafeIntegerSchema,
    quantity: positiveSafeIntegerSchema,
    lineTokenTotal: positiveSafeIntegerSchema,
    displayOrder: nonNegativeSafeIntegerSchema,
  })
  .strict()
  .superRefine((item, context) => {
    const expectedTotal = item.unitTokenPrice * item.quantity;

    if (
      !Number.isSafeInteger(expectedTotal) ||
      item.lineTokenTotal !== expectedTotal
    ) {
      context.addIssue({
        code: "custom",
        message: "Line token total must equal unit token price times quantity.",
        path: ["lineTokenTotal"],
      });
    }
  });

export const orderSchema = z
  .object({
    id: domainIdSchema,
    reference: nonBlankTextSchema.max(120),
    customerId: domainIdSchema,
    vendorId: domainIdSchema,
    customerWalletId: domainIdSchema,
    vendorWalletId: domainIdSchema,
    status: orderStatusSchema,
    items: z.array(orderItemSchema).min(1),
    tokenTotal: positiveSafeIntegerSchema,
    transactionGroupId: domainIdSchema,
    idempotencyKey: idempotencyKeySchema,
    completedAt: utcTimestampSchema,
  })
  .strict()
  .superRefine((order, context) => {
    const expectedTotal = order.items.reduce(
      (total, item) => total + item.lineTokenTotal,
      0,
    );

    if (
      !Number.isSafeInteger(expectedTotal) ||
      order.tokenTotal !== expectedTotal
    ) {
      context.addIssue({
        code: "custom",
        message: "Order token total must equal the sum of its line totals.",
        path: ["tokenTotal"],
      });
    }
  });

export const orderQuerySchema = z
  .object({
    customerId: domainIdSchema.optional(),
    vendorId: domainIdSchema.optional(),
    fromCompletedAt: utcTimestampSchema.optional(),
    toCompletedAt: utcTimestampSchema.optional(),
  })
  .strict();
