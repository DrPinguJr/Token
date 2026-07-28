import { describe, expect, it } from "vitest";

import {
  createDevelopmentDataFacade,
  DevelopmentDataToolsDisabledError,
  DevelopmentPreferenceResetUnavailableError,
} from "./development-data-facade";
import type { LocalDataInitializationResult } from "./local-data";

const initializationResult: LocalDataInitializationResult = {
  status: "initialized",
  metadata: {
    key: "tokenly-data",
    schemaVersion: 1,
    seedVersion: 1,
    seededAt: "2026-07-27T00:00:00.000Z",
  },
};

describe("createDevelopmentDataFacade", () => {
  it("blocks reset and reseed when development tools are disabled", async () => {
    const calls: string[] = [];
    const facade = createDevelopmentDataFacade({
      isEnabled: () => false,
      resetData: async () => {
        calls.push("reset");
      },
      initializeData: async () => initializationResult,
    });

    await expect(facade.reset()).rejects.toBeInstanceOf(
      DevelopmentDataToolsDisabledError,
    );
    await expect(facade.reseed()).rejects.toBeInstanceOf(
      DevelopmentDataToolsDisabledError,
    );
    expect(calls).toEqual([]);
  });

  it("preserves preferences unless their reset is explicitly requested", async () => {
    const calls: string[] = [];
    const facade = createDevelopmentDataFacade({
      isEnabled: () => true,
      resetData: async () => {
        calls.push("reset");
      },
      initializeData: async () => {
        calls.push("initialize");
        return initializationResult;
      },
      clearScopedPreferences: () => {
        calls.push("clear-preferences");
      },
    });

    await facade.reset();
    expect(calls).toEqual(["reset"]);

    calls.length = 0;
    await facade.reseed({ includePreferences: true });
    expect(calls).toEqual(["reset", "clear-preferences", "initialize"]);
  });

  it("checks scoped preference support before resetting application data", async () => {
    const calls: string[] = [];
    const facade = createDevelopmentDataFacade({
      isEnabled: () => true,
      resetData: async () => {
        calls.push("reset");
      },
      initializeData: async () => initializationResult,
    });

    await expect(
      facade.reset({ includePreferences: true }),
    ).rejects.toBeInstanceOf(DevelopmentPreferenceResetUnavailableError);
    expect(calls).toEqual([]);
  });
});
