import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EventHelpReadModel } from "../event-help-query";
import { EventHelpScreen } from "./event-help-screen";

const help: EventHelpReadModel = Object.freeze({
  event: Object.freeze({
    name: "Tokenly Floorball Weekend",
    venue: "Harbour Courts Event Hall",
  }),
  support: Object.freeze({
    label: "Event help desk",
    contact: "help@tokenly.local",
    instructions: "Visit the desk near the main entrance.",
  }),
  developmentAccess: null,
});

describe("EventHelpScreen", () => {
  it("honestly explains the local, manual-payment prototype and support", async () => {
    render(<EventHelpScreen loadHelp={vi.fn(async () => help)} />);

    expect(
      screen.getByRole("heading", { name: /Tokenly, without the mystery/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/not connected to banks, PayNow, SMS/i),
    ).toBeVisible();
    expect(screen.getByText(/PayNow checks are manual/i)).toBeVisible();
    expect(screen.getByText(/full or partial refunds/i)).toBeVisible();
    expect(
      screen.getByText(/QR frames are processed in the browser/i),
    ).toBeVisible();
    expect(await screen.findByText("help@tokenly.local")).toBeVisible();
    expect(screen.getByText(/Visit the desk near/i)).toBeVisible();
    expect(screen.queryByText("2468")).not.toBeInTheDocument();
  });

  it("shows fictional accounts and the development PIN only in gated data", async () => {
    render(
      <EventHelpScreen
        loadHelp={vi.fn(async () => ({
          ...help,
          developmentAccess: {
            pin: "2468",
            accounts: [
              { role: "customer" as const, mobileNumber: "90000001" },
              { role: "vendor" as const, mobileNumber: "90000002" },
            ],
          },
        }))}
      />,
    );

    expect(await screen.findByText("Development tools enabled")).toBeVisible();
    expect(screen.getByText("2468")).toBeVisible();
    expect(screen.getByText("90000001")).toBeVisible();
    expect(screen.getByText("90000002")).toBeVisible();
  });

  it("keeps static guidance and hides raw storage errors", async () => {
    render(
      <EventHelpScreen
        loadHelp={vi.fn(async () => {
          throw new Error("eventSettings/private-record");
        })}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /event-specific support details could not be loaded/i,
    );
    expect(screen.getByText(/PayNow checks are manual/i)).toBeVisible();
    expect(screen.queryByText(/private-record/i)).not.toBeInTheDocument();
  });
});
