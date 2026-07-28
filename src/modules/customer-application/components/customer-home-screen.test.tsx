import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CustomerHomeReadModel } from "../customer-portal-read-model";
import { CustomerHomeScreen } from "./customer-home-screen";

function createHome(
  status: CustomerHomeReadModel["wallet"]["status"] = "active",
): CustomerHomeReadModel {
  return {
    event: {
      name: "Floorball Together 2026",
      subtitle: "Play, cheer, and share a meal.",
      venue: "Our Tampines Hub",
      startsAt: "2026-07-25T00:00:00.000Z",
      endsAt: "2026-07-27T10:00:00.000Z",
    },
    customer: {
      accountId: "account-customer-001",
      customerId: "customer-001",
      displayName: "Ari Rally",
    },
    wallet: {
      id: "wallet-customer-001",
      balance: 154,
      status,
    },
    recentTransactions: [],
  };
}

describe("CustomerHomeScreen", () => {
  it("makes the ledger-derived balance and primary customer actions visible", () => {
    render(<CustomerHomeScreen home={createHome()} />);

    expect(screen.getByText("154")).toBeInTheDocument();
    expect(screen.getByText("tokens")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan to pay" })).toHaveAttribute(
      "href",
      "/customer/scan",
    );
    expect(
      screen.getAllByRole("link", { name: "Browse vendors" })[0],
    ).toHaveAttribute("href", "/customer/vendors");
    expect(screen.getByRole("link", { name: "Show my QR" })).toHaveAttribute(
      "href",
      "/customer/wallet/qr",
    );
    expect(screen.getByText("No wallet activity yet")).toBeInTheDocument();
  });

  it("disables scan for a frozen wallet without hiding QR or history", () => {
    render(<CustomerHomeScreen home={createHome("frozen")} />);

    expect(
      screen.queryByRole("link", { name: "Scan to pay" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Scan unavailable")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText(
        "This wallet is frozen. You can still review its activity.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Show my QR" }),
    ).toBeInTheDocument();
  });
});
