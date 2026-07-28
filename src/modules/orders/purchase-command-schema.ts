import { z } from "zod";

import { walletOperationIdempotencyKeySchema } from "@/modules/transactions";
import { domainIdSchema, positiveSafeIntegerSchema } from "@/shared/validation";

export const purchaseCommandItemSchema = z
  .object({
    productId: domainIdSchema,
    quantity: positiveSafeIntegerSchema,
  })
  .strict();

/**
 * The command deliberately contains no client-calculated price or total.
 * Product names, prices, and availability are reloaded inside the transaction.
 */
export const purchaseCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    customerId: domainIdSchema,
    vendorId: domainIdSchema,
    items: z.array(purchaseCommandItemSchema).min(1),
    idempotencyKey: walletOperationIdempotencyKeySchema,
  })
  .strict()
  .superRefine((command, context) => {
    const seenProductIds = new Set<string>();

    command.items.forEach((item, index) => {
      if (seenProductIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          message: "Each product may appear only once in a purchase command.",
          path: ["items", index, "productId"],
        });
      }

      seenProductIds.add(item.productId);
    });
  });

export type PurchaseCommandItem = Readonly<
  z.infer<typeof purchaseCommandItemSchema>
>;
export type PurchaseCommand = Readonly<z.infer<typeof purchaseCommandSchema>>;
