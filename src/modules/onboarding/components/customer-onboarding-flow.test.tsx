import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CUSTOMER_ONBOARDING_COMPLETION_ERROR_MESSAGE } from "../onboarding-feedback";
import { CustomerOnboardingFlow } from "./customer-onboarding-flow";

describe("CustomerOnboardingFlow", () => {
  it("moves forward and back while retaining progress", async () => {
    const user = userEvent.setup();

    render(
      <CustomerOnboardingFlow
        developmentSkipEnabled={false}
        displayName="Noa"
        onComplete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome to Tokenly" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", { name: "Meet event tokens" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "2",
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "Welcome to Tokenly" }),
    ).toBeInTheDocument();
  });

  it("completes the fourth step through the guided path", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn().mockResolvedValue(undefined);

    render(
      <CustomerOnboardingFlow
        developmentSkipEnabled={false}
        displayName="Noa"
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "You’re now a Tokener" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enter Tokenly" }));

    expect(onComplete).toHaveBeenCalledWith("guided");
  });

  it("shows the development skip only when enabled and records its method", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <CustomerOnboardingFlow
        developmentSkipEnabled={false}
        displayName="Noa"
        onComplete={onComplete}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /skip tour/i }),
    ).not.toBeInTheDocument();

    rerender(
      <CustomerOnboardingFlow
        developmentSkipEnabled
        displayName="Noa"
        onComplete={onComplete}
      />,
    );
    await user.click(screen.getByRole("button", { name: /skip tour/i }));

    expect(onComplete).toHaveBeenCalledWith("development_skip");
  });

  it("surfaces a recoverable completion error", async () => {
    const user = userEvent.setup();
    const onComplete = vi
      .fn()
      .mockRejectedValue(new Error("Local data is unavailable."));

    render(
      <CustomerOnboardingFlow
        developmentSkipEnabled
        displayName="Noa"
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /skip tour/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      CUSTOMER_ONBOARDING_COMPLETION_ERROR_MESSAGE,
    );
    expect(
      screen.queryByText("Local data is unavailable."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip tour/i })).toBeEnabled();
  });
});
