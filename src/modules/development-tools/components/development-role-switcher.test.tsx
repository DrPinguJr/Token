import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AccountSummary } from "@/modules/accounts";

import { DevelopmentRoleSwitcher } from "./development-role-switcher";

const accounts: readonly AccountSummary[] = [
  {
    id: "account-customer-001",
    mobileNumber: "90000001",
    displayName: "Ari Rally",
    role: "customer",
    status: "active",
    createdAt: "2026-07-01T01:00:00.000Z",
    updatedAt: "2026-07-01T01:00:00.000Z",
  },
  {
    id: "account-vendor-001",
    mobileNumber: "90000002",
    displayName: "Courtside Kitchen Team",
    role: "vendor",
    status: "active",
    createdAt: "2026-07-01T01:01:00.000Z",
    updatedAt: "2026-07-01T01:01:00.000Z",
  },
];

describe("DevelopmentRoleSwitcher", () => {
  it("lists seeded accounts and marks the current normal-shaped session", () => {
    render(
      <DevelopmentRoleSwitcher
        accounts={accounts}
        currentAccountId="account-customer-001"
        onSwitch={vi.fn()}
      />,
    );

    expect(screen.getByText("Ari Rally")).toBeInTheDocument();
    expect(screen.getByText("Courtside Kitchen Team")).toBeInTheDocument();
    expect(screen.getByText("90000002")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Active session" }),
    ).toBeDisabled();
  });

  it("switches through the supplied runtime action", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn().mockResolvedValue(undefined);

    render(
      <DevelopmentRoleSwitcher
        accounts={accounts}
        currentAccountId="account-customer-001"
        onSwitch={onSwitch}
      />,
    );

    await user.click(screen.getByRole("button", { name: /use this account/i }));

    expect(onSwitch).toHaveBeenCalledWith("account-vendor-001");
  });

  it("reports a recoverable runtime error", async () => {
    const user = userEvent.setup();
    const onSwitch = vi
      .fn()
      .mockRejectedValue(new Error("The account is no longer active."));

    render(
      <DevelopmentRoleSwitcher
        accounts={accounts}
        currentAccountId={null}
        onSwitch={onSwitch}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /use this account/i })[0]!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The account is no longer active.",
    );
  });
});
