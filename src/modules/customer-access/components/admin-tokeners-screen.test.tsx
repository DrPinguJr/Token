import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AdminTokenerAccessSummary } from "../customer-access-read-model";
import { AdminTokenersScreen } from "./admin-tokeners-screen";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/config/qr-code-image-generator", () => ({
  generateRouteQrCodeDataUrl: vi.fn(async () => "data:image/png;base64,qr"),
}));

const tokener: AdminTokenerAccessSummary = {
  balance: 10,
  claimExpiresAt: "2026-08-01T00:00:00.000Z",
  claimedAt: null,
  claimPath: "/claim/claim_secret_value",
  customerId: "customer-001",
  displayName: "Lance Tan",
  mobileNumber: "91234567",
  transactions: [
    {
      description: "Vendor quick charge customer wallet debit.",
      direction: "debit",
      entryType: "customer_purchase",
      id: "ledger-purchase-001",
      occurredAt: "2026-07-31T09:00:00.000Z",
      reference: "PAY-001",
      refundableTokenAmount: 10,
      title: "Vendor charge",
      tokenAmount: 10,
      transactionGroupId: "11111111-1111-4111-8111-111111111111",
      vendorName: "Vendor 1",
      vendorUsername: "Vendor1",
    },
  ],
  walletPublicCode: "cus_private_wallet_code",
  walletQrUpdatedAt: "2026-07-31T09:00:00.000Z",
};

describe("AdminTokenersScreen", () => {
  it("opens tokener details in a popup without showing private codes", async () => {
    const user = userEvent.setup();

    render(<AdminTokenersScreen loadTokeners={vi.fn(async () => [tokener])} />);

    await user.click(await screen.findByRole("button", { name: /Lance Tan/i }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Transaction history")).toBeVisible();
    expect(screen.queryByText(/claim_secret_value/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/cus_private_wallet_code/),
    ).not.toBeInTheDocument();
  });

  it("submits a partial administrator refund from a purchase transaction", async () => {
    const user = userEvent.setup();
    const listTokener = { ...tokener, transactions: [] };
    const loadTokenerDetail = vi.fn(async () => tokener);
    const refundTokenerTransaction = vi.fn(async () => ({
      ...tokener,
      balance: 14,
      transactions: [
        {
          ...tokener.transactions[0]!,
          refundableTokenAmount: 6,
        },
      ],
    }));

    render(
      <AdminTokenersScreen
        loadTokenerDetail={loadTokenerDetail}
        loadTokeners={vi.fn(async () => [listTokener])}
        refundTokenerTransaction={refundTokenerTransaction}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Lance Tan/i }));
    await user.click(await screen.findByRole("button", { name: "Refund" }));
    await user.clear(screen.getByLabelText("Tokens"));
    await user.type(screen.getByLabelText("Tokens"), "4");
    await user.type(
      screen.getByLabelText("Reason"),
      "Vendor charged 10 tokens for a 6-token item.",
    );
    await user.click(screen.getByRole("button", { name: "Record refund" }));

    await waitFor(() => {
      expect(loadTokenerDetail).toHaveBeenCalledWith("customer-001");
      expect(refundTokenerTransaction).toHaveBeenCalledWith({
        customerId: "customer-001",
        purchaseTransactionGroupId: "11111111-1111-4111-8111-111111111111",
        reason: "Vendor charged 10 tokens for a 6-token item.",
        tokenAmount: 4,
      });
    });
  });
});
