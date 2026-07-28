import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_ENTRY_FAILURE_MESSAGE,
  AccountEntryFailedError,
} from "../account-entry-service";
import {
  ACCOUNT_ENTRY_RECOVERY_MESSAGE,
  AccountEntryScreen,
} from "./account-entry-screen";

function renderReadyScreen(
  options: Readonly<{
    onEnter?: (input: Readonly<{ mobileNumber: string }>) => Promise<void>;
  }> = {},
) {
  const onEnter = options.onEnter ?? vi.fn(async () => undefined);

  render(
    <AccountEntryScreen
      runtimeStatus="ready"
      runtimeErrorMessage={null}
      onEnter={onEnter}
      onRetry={vi.fn(async () => undefined)}
    />,
  );

  return { onEnter };
}

describe("AccountEntryScreen", () => {
  it("discloses the unverified local flow and requests no PIN", () => {
    renderReadyScreen();

    expect(
      screen.getByText(/mobile numbers are not verified/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no sms will be sent/i)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /mobile number/i }),
    ).toHaveAttribute("type", "tel");
    expect(screen.queryByLabelText(/pin/i)).not.toBeInTheDocument();
  });

  it("normalizes formatted mobile input before requesting entry", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => undefined);
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /mobile number/i }),
      "+65 9000-0001",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(onEnter).toHaveBeenCalledWith({ mobileNumber: "90000001" });
    });
  });

  it("keeps malformed input at the form boundary", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => undefined);
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /mobile number/i }),
      "not-a-number",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("Enter a valid mobile number."),
    ).toBeVisible();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("shows the generic lookup failure for a typed unavailable account", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => {
      throw new AccountEntryFailedError();
    });
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /mobile number/i }),
      "90000001",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText(ACCOUNT_ENTRY_FAILURE_MESSAGE),
    ).toBeVisible();
    expect(screen.queryByText(/disabled account/i)).not.toBeInTheDocument();
  });

  it("maps storage or audit failures to safe recoverable copy", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => {
      throw new Error("auditLogs/secret-internal-record");
    });
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /mobile number/i }),
      "90000001",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText(ACCOUNT_ENTRY_RECOVERY_MESSAGE),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reopen local data" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/secret-internal-record/i),
    ).not.toBeInTheDocument();
  });

  it("offers a safe retry when local data cannot open", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn(async () => undefined);

    render(
      <AccountEntryScreen
        runtimeStatus="error"
        runtimeErrorMessage="Tokenly local data is unavailable. Try opening it again."
        onEnter={vi.fn(async () => undefined)}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /local data did not open/i,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
