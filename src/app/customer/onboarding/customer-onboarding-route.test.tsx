import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenlyRuntimeValue } from "@/config/tokenly-runtime-provider";
import type { AuthenticatedSessionReadModel } from "@/modules/authentication";
import {
  CUSTOMER_ONBOARDING_LOAD_ERROR_MESSAGE,
  CUSTOMER_ONBOARDING_RETRY_ERROR_MESSAGE,
} from "@/modules/onboarding";

const routeMocks = vi.hoisted(() => ({
  complete: vi.fn(),
  refreshSession: vi.fn(),
  reloadRuntime: vi.fn(),
  replace: vi.fn(),
  runtime: null as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routeMocks.replace,
  }),
}));

vi.mock("@/config/tokenly-runtime-provider", () => ({
  useTokenlyRuntime: () => routeMocks.runtime as TokenlyRuntimeValue,
}));

vi.mock("@/config/configured-customer-onboarding-service", () => ({
  createConfiguredCustomerOnboardingService: () => ({
    complete: routeMocks.complete,
  }),
}));

import { CustomerOnboardingRoute } from "./customer-onboarding-route";

function createSession(
  overrides: Partial<AuthenticatedSessionReadModel> = {},
): AuthenticatedSessionReadModel {
  return {
    account: {
      id: "account-customer-003",
      displayName: "Noa Swift",
      role: "customer",
    },
    customer: {
      id: "customer-003",
      walletId: "wallet-customer-003",
      onboardingCompletedAt: null,
    },
    destination: "/customer/onboarding",
    ...overrides,
  };
}

function setReadyRuntime(session: AuthenticatedSessionReadModel | null): void {
  routeMocks.runtime = {
    status: "ready",
    session,
    errorMessage: null,
    enterAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    switchDevelopmentAccount: vi.fn(),
    refreshSession: routeMocks.refreshSession,
    signOut: vi.fn(),
    reloadRuntime: routeMocks.reloadRuntime,
  } satisfies TokenlyRuntimeValue;
}

function setErrorRuntime(): void {
  routeMocks.runtime = {
    status: "error",
    session: null,
    errorMessage: "Internal database name and stack diagnostics.",
    enterAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    switchDevelopmentAccount: vi.fn(),
    refreshSession: routeMocks.refreshSession,
    signOut: vi.fn(),
    reloadRuntime: routeMocks.reloadRuntime,
  } satisfies TokenlyRuntimeValue;
}

describe("CustomerOnboardingRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.complete.mockResolvedValue({
      customerId: "customer-003",
      completedAt: "2026-07-27T08:30:00.000Z",
      status: "completed",
    });
    routeMocks.refreshSession.mockResolvedValue(
      createSession({
        customer: {
          id: "customer-003",
          walletId: "wallet-customer-003",
          onboardingCompletedAt: "2026-07-27T08:30:00.000Z",
        },
        destination: "/customer",
      }),
    );
    routeMocks.reloadRuntime.mockResolvedValue(undefined);
  });

  it("renders the real flow for an incomplete customer", () => {
    setReadyRuntime(createSession());

    render(<CustomerOnboardingRoute />);

    expect(
      screen.getByRole("heading", { name: "Welcome to Tokenly" }),
    ).toBeInTheDocument();
    expect(routeMocks.replace).not.toHaveBeenCalled();
  });

  it("does not block a non-customer account on onboarding", async () => {
    setReadyRuntime(
      createSession({
        account: {
          id: "account-vendor-001",
          displayName: "Courtside Kitchen Team",
          role: "vendor",
        },
        customer: null,
        destination: "/vendor/dashboard",
      }),
    );

    render(<CustomerOnboardingRoute />);

    await waitFor(() => {
      expect(routeMocks.replace).toHaveBeenCalledWith("/vendor/dashboard");
    });
    expect(
      screen.queryByRole("heading", { name: "Welcome to Tokenly" }),
    ).not.toBeInTheDocument();
  });

  it("routes a completed customer directly into the customer app", async () => {
    setReadyRuntime(
      createSession({
        customer: {
          id: "customer-003",
          walletId: "wallet-customer-003",
          onboardingCompletedAt: "2026-07-27T08:30:00.000Z",
        },
        destination: "/customer",
      }),
    );

    render(<CustomerOnboardingRoute />);

    await waitFor(() => {
      expect(routeMocks.replace).toHaveBeenCalledWith("/customer");
    });
  });

  it("uses safe runtime copy and catches a failed retry", async () => {
    const user = userEvent.setup();
    routeMocks.reloadRuntime.mockRejectedValueOnce(
      new Error("IndexedDB secret implementation detail."),
    );
    setErrorRuntime();

    render(<CustomerOnboardingRoute />);

    expect(
      screen.getByText(CUSTOMER_ONBOARDING_LOAD_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Internal database name and stack diagnostics."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText(CUSTOMER_ONBOARDING_RETRY_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(routeMocks.reloadRuntime).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("IndexedDB secret implementation detail."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
