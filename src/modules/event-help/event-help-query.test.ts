import { describe, expect, it, vi } from "vitest";

import type { EventSettings } from "@/modules/event-settings";

import { EventHelpQuery, type DevelopmentHelpAccess } from "./event-help-query";

const settings: EventSettings = Object.freeze({
  id: "event-settings-main",
  eventName: "Tokenly Floorball Weekend",
  eventSubtitle: "Two days of floorball, food, and community",
  eventDates: {
    startsAt: "2026-07-25T00:00:00.000Z",
    endsAt: "2026-07-26T10:00:00.000Z",
  },
  venue: "Harbour Courts Event Hall",
  tokensPerDollar: 10,
  supportLabel: "Event help desk",
  supportContact: "help@tokenly.local",
  supportInstructions: "Visit the desk near the main entrance.",
  updatedByAccountId: "account-admin-001",
  updatedAt: "2026-07-10T00:00:00.000Z",
});

const developmentAccess: DevelopmentHelpAccess = Object.freeze({
  pin: "2468",
  accounts: Object.freeze([
    Object.freeze({ role: "customer", mobileNumber: "90000001" }),
  ]),
});

function createQuery(developmentToolsEnabled: boolean) {
  return new EventHelpQuery({
    developmentAccess,
    isDevelopmentToolsEnabled: () => developmentToolsEnabled,
    repositories: {
      eventSettings: { get: vi.fn(async () => settings) },
    },
  });
}

describe("EventHelpQuery", () => {
  it("maps event support settings without exposing administrative metadata", async () => {
    await expect(createQuery(false).get()).resolves.toEqual({
      event: {
        name: settings.eventName,
        venue: settings.venue,
      },
      support: {
        label: settings.supportLabel,
        contact: settings.supportContact,
        instructions: settings.supportInstructions,
      },
      developmentAccess: null,
    });
  });

  it("includes fictional accounts and the development PIN only when enabled", async () => {
    await expect(createQuery(true).get()).resolves.toMatchObject({
      developmentAccess,
    });
  });

  it("keeps general help usable when event settings are unavailable", async () => {
    const query = new EventHelpQuery({
      developmentAccess,
      isDevelopmentToolsEnabled: () => false,
      repositories: {
        eventSettings: { get: vi.fn(async () => null) },
      },
    });

    await expect(query.get()).resolves.toEqual({
      event: null,
      support: null,
      developmentAccess: null,
    });
  });
});
