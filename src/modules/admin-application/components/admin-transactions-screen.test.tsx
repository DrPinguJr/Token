import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminTransactionOverview } from "../admin-transaction-read-model";
import { AdminTransactionsScreen } from "./admin-transactions-screen";

const emptyOverview: AdminTransactionOverview = {
  metrics: {
    issuedTokens: 0,
    refundedTokens: 0,
    spentTokens: 0,
    transactionGroups: 0,
  },
  transactions: [],
};

describe("AdminTransactionsScreen", () => {
  it("shows zero metrics and a useful empty state for a connected empty database", async () => {
    render(
      <AdminTransactionsScreen
        loadOverview={vi.fn(async () => emptyOverview)}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "No transactions yet" }),
    ).toBeVisible();
    expect(screen.getAllByText("0")).toHaveLength(4);
    expect(screen.getByText(/Supabase is connected/i)).toBeVisible();
  });

  it("explains missing localhost Supabase configuration and can retry", async () => {
    const user = userEvent.setup();
    const loadOverview = vi
      .fn<() => Promise<AdminTransactionOverview>>()
      .mockRejectedValueOnce(new Error("SUPABASE_SERVER_CONFIGURATION_ERROR"))
      .mockResolvedValueOnce(emptyOverview);

    render(<AdminTransactionsScreen loadOverview={loadOverview} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/i,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "No transactions yet" }),
    ).toBeVisible();
    expect(loadOverview).toHaveBeenCalledTimes(2);
  });
});
