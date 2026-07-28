import { describe, expect, it } from "vitest";

import { orderSchema } from "@/modules/orders";

const validOrder = {
  id: "order-001",
  reference: "ORD-001",
  customerId: "customer-001",
  vendorId: "vendor-001",
  customerWalletId: "wallet-customer-001",
  vendorWalletId: "wallet-vendor-001",
  status: "completed",
  items: [
    {
      productId: "product-001",
      productName: "Event sandwich",
      unitTokenPrice: 4,
      quantity: 2,
      lineTokenTotal: 8,
      displayOrder: 0,
    },
  ],
  tokenTotal: 8,
  transactionGroupId: "group-purchase-001",
  idempotencyKey: "purchase-001",
  completedAt: "2026-07-27T02:00:00.000Z",
} as const;

describe("orderSchema", () => {
  it("accepts immutable repository-price snapshots", () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects an empty order", () => {
    expect(
      orderSchema.safeParse({
        ...validOrder,
        items: [],
      }).success,
    ).toBe(false);
  });

  it("rejects inconsistent line and order totals", () => {
    expect(
      orderSchema.safeParse({
        ...validOrder,
        items: [{ ...validOrder.items[0], lineTokenTotal: 7 }],
      }).success,
    ).toBe(false);

    expect(
      orderSchema.safeParse({
        ...validOrder,
        tokenTotal: 9,
      }).success,
    ).toBe(false);
  });
});
