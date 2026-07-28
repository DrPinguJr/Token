import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenlyRuntimeValue } from "@/config/tokenly-runtime-provider";
import type { DevelopmentAccountReadModel } from "@/modules/development-tools";

const roleRouteMocks = vi.hoisted(() => ({
  list: vi.fn(),
  push: vi.fn(),
  runtime: null as unknown,
  switchDevelopmentAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: roleRouteMocks.push,
  }),
}));

vi.mock("@/config/tokenly-runtime-provider", () => ({
  useTokenlyRuntime: () => roleRouteMocks.runtime as TokenlyRuntimeValue,
}));

import { DevelopmentRoleSwitcherRoute } from "./role-switcher-route";

const originalDevelopmentToolsValue =
  process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;

const accounts: readonly DevelopmentAccountReadModel[] = [
  {
    id: "account-customer-001",
    mobileNumber: "90000001",
    displayName: "Ari Rally",
    role: "customer",
  },
  {
    id: "account-vendor-001",
    mobileNumber: "90000002",
    displayName: "Courtside Kitchen Team",
    role: "vendor",
  },
];

describe("DevelopmentRoleSwitcherRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS = "true";
    roleRouteMocks.list.mockResolvedValue(accounts);
    roleRouteMocks.switchDevelopmentAccount.mockResolvedValue({
      account: {
        id: "account-vendor-001",
        displayName: "Courtside Kitchen Team",
        role: "vendor",
      },
      customer: null,
      destination: "/vendor/dashboard",
    });
    roleRouteMocks.runtime = {
      status: "ready",
      session: {
        account: {
          id: "account-customer-001",
          displayName: "Ari Rally",
          role: "customer",
        },
        customer: {
          id: "customer-001",
          walletId: "wallet-customer-001",
          onboardingCompletedAt: "2026-07-05T02:00:00.000Z",
        },
        destination: "/customer",
      },
      errorMessage: null,
      enterAccount: vi.fn(),
      listDevelopmentAccounts: roleRouteMocks.list,
      switchDevelopmentAccount: roleRouteMocks.switchDevelopmentAccount,
      refreshSession: vi.fn(),
      signOut: vi.fn(),
      reloadRuntime: vi.fn(),
    } as unknown as TokenlyRuntimeValue;
  });

  afterEach(() => {
    if (originalDevelopmentToolsValue === undefined) {
      delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
    } else {
      process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS =
        originalDevelopmentToolsValue;
    }
  });

  it("loads active seeded accounts and switches through the runtime API", async () => {
    const user = userEvent.setup();
    render(<DevelopmentRoleSwitcherRoute />);

    await screen.findByText("Courtside Kitchen Team");
    await user.click(screen.getByRole("button", { name: /use this account/i }));

    await waitFor(() => {
      expect(roleRouteMocks.list).toHaveBeenCalledWith();
      expect(roleRouteMocks.switchDevelopmentAccount).toHaveBeenCalledWith(
        "account-vendor-001",
      );
      expect(roleRouteMocks.push).toHaveBeenCalledWith("/vendor/dashboard");
    });
  });
});
