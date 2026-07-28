import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CustomerTransactionDetailReadModel } from "../customer-portal-read-model";
import { CustomerTransactionDetailScreen } from "./customer-transaction-detail-screen";

const purchaseDetail = Object.freeze({
  id: "ledger-purchase-001",
  transactionGroupId: "transaction-purchase-001",
  kind: "purchase",
  direction: "debit",
  tokenAmount: 24,
  reference: "ORD-20260725-001",
  occurredAt: "2026-07-25T02:00:00.000Z",
  title: "Purchase at Courtside Kitchen",
  description: "Customer wallet debit for completed order.",
  vendorName: "Courtside Kitchen",
  order: {
    id: "order-001",
    reference: "ORD-20260725-001",
    completedAt: "2026-07-25T02:00:00.000Z",
    tokenTotal: 24,
    items: [
      {
        productId: "product-food-001",
        productName: "Chicken Rice Bowl",
        unitTokenPrice: 12,
        quantity: 1,
        lineTokenTotal: 12,
      },
      {
        productId: "product-food-002",
        productName: "Chilled Cocoa",
        unitTokenPrice: 6,
        quantity: 2,
        lineTokenTotal: 12,
      },
    ],
    refundedTokenAmount: 6,
  },
  refunds: [
    {
      id: "refund-001",
      reference: "REF-20260725-001",
      tokenAmount: 6,
      reason: "One chilled drink was unavailable at collection.",
      createdAt: "2026-07-25T04:00:00.000Z",
    },
  ],
  selectedRefundId: null,
  issuance: null,
} satisfies CustomerTransactionDetailReadModel);

describe("CustomerTransactionDetailScreen", () => {
  it("presents an authoritative persisted order as a success receipt", () => {
    render(
      <CustomerTransactionDetailScreen detail={purchaseDetail} showReceipt />,
    );

    expect(screen.getByText("Purchase complete")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Enjoy your order" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ORD-20260725-001").length).toBeGreaterThan(0);
    expect(screen.getByText("Chicken Rice Bowl")).toBeInTheDocument();
    expect(screen.getByText("Chilled Cocoa")).toBeInTheDocument();
    expect(screen.getByText("24 tokens")).toBeInTheDocument();
    expect(screen.getByText("6 tokens")).toBeInTheDocument();
    expect(screen.getByText("REF-20260725-001")).toBeInTheDocument();
  });
});
