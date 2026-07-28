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
    onEnter?: (
      input: Readonly<{ username: string; password: string }>,
    ) => Promise<void>;
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
  it("discloses QR-only tokener access and requests operational credentials", () => {
    renderReadyScreen();

    expect(screen.getByText(/tokener access is qr-only/i)).toBeInTheDocument();
    expect(screen.getAllByText(/one-time claim qr/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: /username/i })).toHaveAttribute(
      "type",
      "text",
    );
    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("submits the admin credential input", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => undefined);
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /username/i }),
      "AdminLance",
    );
    await user.type(screen.getByLabelText(/password/i), "Lance888!");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(onEnter).toHaveBeenCalledWith({
        username: "AdminLance",
        password: "Lance888!",
      });
    });
  });

  it("keeps malformed input at the form boundary", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => undefined);
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /username/i }),
      "90000001",
    );
    await user.type(screen.getByLabelText(/password/i), "Lance888!");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Enter a valid username.")).toBeVisible();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("shows the generic lookup failure for incorrect credentials", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn(async () => {
      throw new AccountEntryFailedError();
    });
    renderReadyScreen({ onEnter });

    await user.type(
      screen.getByRole("textbox", { name: /username/i }),
      "AdminLance",
    );
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
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
      screen.getByRole("textbox", { name: /username/i }),
      "AdminLance",
    );
    await user.type(screen.getByLabelText(/password/i), "Lance888!");
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
