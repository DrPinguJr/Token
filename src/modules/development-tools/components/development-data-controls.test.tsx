import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DevelopmentDataControls } from "./development-data-controls";

describe("DevelopmentDataControls", () => {
  it("requires the exact confirmation phrase", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();

    render(<DevelopmentDataControls onRun={onRun} />);

    const resetButton = screen.getByRole("button", { name: "Reset data" });
    expect(resetButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "reset tokenly",
    );
    expect(resetButton).toBeDisabled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("passes the optional scoped preference choice to reset", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn().mockResolvedValue("Local data was reset.");

    render(<DevelopmentDataControls onRun={onRun} />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /also clear the tokenly session/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    expect(onRun).toHaveBeenCalledWith({
      action: "reset",
      includePreferences: true,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Local data was reset.",
    );
  });

  it("runs reset and reseed as a distinct confirmed action", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn().mockResolvedValue("Seed version 2 is ready.");

    render(<DevelopmentDataControls onRun={onRun} />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(screen.getByRole("button", { name: "Reset and reseed" }));

    expect(onRun).toHaveBeenCalledWith({
      action: "reseed",
      includePreferences: false,
    });
  });

  it("reports an exact recoverable failure", async () => {
    const user = userEvent.setup();
    const onRun = vi
      .fn()
      .mockRejectedValue(new Error("The IndexedDB connection was blocked."));

    render(<DevelopmentDataControls onRun={onRun} />);

    await user.type(
      screen.getByLabelText(/type reset tokenly to confirm/i),
      "RESET TOKENLY",
    );
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The IndexedDB connection was blocked.",
    );
  });
});
