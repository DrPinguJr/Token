import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WalletPinChangePanel } from "./wallet-pin-change-panel";

describe("WalletPinChangePanel", () => {
  it("uses one PIN-change attempt and clears all plain-text PIN fields", async () => {
    const user = userEvent.setup();
    const changePin = vi.fn().mockResolvedValue({
      status: "changed",
      accountId: "account-customer-001",
    });

    render(<WalletPinChangePanel onChangePin={changePin} />);

    const currentPin = screen.getByLabelText("Current PIN");
    const newPin = screen.getByLabelText("New PIN");
    const confirmedPin = screen.getByLabelText("Confirm new PIN");
    await user.type(currentPin, "2468");
    await user.type(newPin, "1357");
    await user.type(confirmedPin, "1357");
    await user.click(screen.getByRole("button", { name: "Change PIN" }));

    await waitFor(() => {
      expect(changePin).toHaveBeenCalledWith("2468", "1357");
    });
    expect(
      await screen.findByText("Your wallet PIN has been changed."),
    ).toBeInTheDocument();
    expect(currentPin).toHaveValue("");
    expect(newPin).toHaveValue("");
    expect(confirmedPin).toHaveValue("");
    expect(screen.queryByDisplayValue("2468")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("1357")).not.toBeInTheDocument();
  });

  it("rejects mismatched new PINs before calling the service", async () => {
    const user = userEvent.setup();
    const changePin = vi.fn();

    render(<WalletPinChangePanel onChangePin={changePin} />);

    await user.type(screen.getByLabelText("Current PIN"), "2468");
    await user.type(screen.getByLabelText("New PIN"), "1357");
    await user.type(screen.getByLabelText("Confirm new PIN"), "1358");
    await user.click(screen.getByRole("button", { name: "Change PIN" }));

    expect(
      await screen.findByText("The new PINs do not match."),
    ).toBeInTheDocument();
    expect(changePin).not.toHaveBeenCalled();
  });
});
