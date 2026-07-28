import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenlyRuntimeValue } from "@/config/tokenly-runtime-provider";

const dataRouteMocks = vi.hoisted(() => ({
  reloadRuntime: vi.fn(),
  reseed: vi.fn(),
  reset: vi.fn(),
  runtime: null as unknown,
  signOut: vi.fn(),
}));

vi.mock("@/config/development-data-facade", () => ({
  createConfiguredDevelopmentDataFacade: () => ({
    reset: dataRouteMocks.reset,
    reseed: dataRouteMocks.reseed,
  }),
}));

vi.mock("@/config/tokenly-runtime-provider", () => ({
  useTokenlyRuntime: () => dataRouteMocks.runtime as TokenlyRuntimeValue,
}));

import { DevelopmentDataRoute } from "./development-data-route";

function createRuntime(
  status: TokenlyRuntimeValue["status"],
): TokenlyRuntimeValue {
  return {
    status,
    session: null,
    errorMessage: status === "error" ? "Internal IndexedDB diagnostics." : null,
    enterAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    switchDevelopmentAccount: vi.fn(),
    refreshSession: vi.fn(),
    signOut: dataRouteMocks.signOut,
    reloadRuntime: dataRouteMocks.reloadRuntime,
  } satisfies TokenlyRuntimeValue;
}

describe("DevelopmentDataRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataRouteMocks.runtime = createRuntime("ready");
    dataRouteMocks.reset.mockResolvedValue(undefined);
    dataRouteMocks.reseed.mockResolvedValue({
      status: "initialized",
      metadata: {
        key: "tokenly-data",
        schemaVersion: 2,
        seedVersion: 2,
        seededAt: "2026-07-27T08:30:00.000Z",
      },
    });
    dataRouteMocks.reloadRuntime.mockResolvedValue(undefined);
  });

  it("reopens an intentionally empty runtime after reset", async () => {
    const user = userEvent.setup();
    render(<DevelopmentDataRoute />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    await waitFor(() => {
      expect(dataRouteMocks.reset).toHaveBeenCalledWith({
        includePreferences: false,
      });
      expect(dataRouteMocks.reloadRuntime).toHaveBeenCalledWith({
        initializeData: false,
      });
    });
  });

  it("reinitializes the normal runtime only after reseed completes", async () => {
    const user = userEvent.setup();
    render(<DevelopmentDataRoute />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(screen.getByRole("button", { name: "Reset and reseed" }));

    await waitFor(() => {
      expect(dataRouteMocks.reseed).toHaveBeenCalledWith({
        includePreferences: false,
      });
      expect(dataRouteMocks.reloadRuntime).toHaveBeenCalledWith();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Schema version 2, seed version 2",
    );
  });

  it("keeps reset and reseed recovery available when the runtime is in error", async () => {
    const user = userEvent.setup();
    dataRouteMocks.runtime = createRuntime("error");
    render(<DevelopmentDataRoute />);

    expect(
      screen.getByText(/reset or reseed below to recover it/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Internal IndexedDB diagnostics."),
    ).not.toBeInTheDocument();

    const confirmation = screen.getByLabelText(
      /type reset tokenly to confirm/i,
    );
    await user.type(confirmation, "RESET TOKENLY");
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    await waitFor(() => {
      expect(dataRouteMocks.reset).toHaveBeenCalledWith({
        includePreferences: false,
      });
      expect(dataRouteMocks.reloadRuntime).toHaveBeenCalledWith({
        initializeData: false,
      });
    });

    await user.type(confirmation, "RESET TOKENLY");
    await user.click(screen.getByRole("button", { name: "Reset and reseed" }));

    await waitFor(() => {
      expect(dataRouteMocks.reseed).toHaveBeenCalledWith({
        includePreferences: false,
      });
      expect(dataRouteMocks.reloadRuntime).toHaveBeenLastCalledWith();
    });
  });

  it("preserves success feedback while the runtime context reloads", async () => {
    const user = userEvent.setup();
    let finishReload: (() => void) | undefined;
    dataRouteMocks.reloadRuntime.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishReload = resolve;
      }),
    );
    const view = render(<DevelopmentDataRoute />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(screen.getByRole("button", { name: "Reset and reseed" }));
    await waitFor(() => {
      expect(dataRouteMocks.reloadRuntime).toHaveBeenCalled();
    });

    dataRouteMocks.runtime = createRuntime("loading");
    view.rerender(<DevelopmentDataRoute />);
    expect(
      screen.getByRole("button", { name: "Reseeding…" }),
    ).toBeInTheDocument();

    finishReload?.();
    expect(
      await screen.findByText(/schema version 2, seed version 2/i),
    ).toBeInTheDocument();

    dataRouteMocks.runtime = createRuntime("ready");
    view.rerender(<DevelopmentDataRoute />);
    expect(
      screen.getByText(/schema version 2, seed version 2/i),
    ).toBeInTheDocument();
  });
});
