import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenlyRuntimeValue } from "@/config/tokenly-runtime-provider";
import type { AuthenticatedSessionReadModel } from "@/modules/authentication";

const enterPageMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  runtime: null as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: enterPageMocks.replace,
  }),
}));

vi.mock("@/config/tokenly-runtime-provider", () => ({
  useTokenlyRuntime: () => enterPageMocks.runtime as TokenlyRuntimeValue,
}));

import { EnterPageClient } from "./enter-page-client";

const vendorSession: AuthenticatedSessionReadModel = {
  account: {
    id: "account-vendor-001",
    displayName: "Courtside Kitchen Team",
    role: "vendor",
  },
  customer: null,
  destination: "/vendor/dashboard",
};

function createRuntime(
  overrides: Partial<TokenlyRuntimeValue> = {},
): TokenlyRuntimeValue {
  return {
    status: "ready",
    session: null,
    errorMessage: null,
    enterAccount: vi.fn(async () => vendorSession),
    listDevelopmentAccounts: vi.fn(async () => []),
    switchDevelopmentAccount: vi.fn(async () => vendorSession),
    refreshSession: vi.fn(async () => null),
    signOut: vi.fn(),
    reloadRuntime: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("EnterPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterPageMocks.runtime = createRuntime();
  });

  it("owns the single redirect for an already resolved session", async () => {
    enterPageMocks.runtime = createRuntime({ session: vendorSession });

    render(<EnterPageClient />);

    await waitFor(() => {
      expect(enterPageMocks.replace).toHaveBeenCalledTimes(1);
      expect(enterPageMocks.replace).toHaveBeenCalledWith("/vendor/dashboard");
    });
  });

  it("redirects once after account entry resolves its destination", async () => {
    const user = userEvent.setup();
    const enterAccount = vi.fn(async () => vendorSession);
    enterPageMocks.runtime = createRuntime({ enterAccount });

    render(<EnterPageClient />);
    await user.type(
      screen.getByRole("textbox", { name: /username/i }),
      "AdminLance",
    );
    await user.type(screen.getByLabelText(/password/i), "Lance888!");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(enterAccount).toHaveBeenCalledWith({
        username: "AdminLance",
        password: "Lance888!",
      });
      expect(enterPageMocks.replace).toHaveBeenCalledTimes(1);
      expect(enterPageMocks.replace).toHaveBeenCalledWith("/vendor/dashboard");
    });
  });
});
