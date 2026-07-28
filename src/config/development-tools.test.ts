import { describe, expect, it } from "vitest";

import {
  areDevelopmentToolsEnabled,
  assertDevelopmentToolsEnabled,
  DevelopmentToolsDisabledError,
} from "./development-tools";

describe("areDevelopmentToolsEnabled", () => {
  it("enables tools only for the explicit lowercase true value", () => {
    expect(areDevelopmentToolsEnabled("true")).toBe(true);
    expect(areDevelopmentToolsEnabled("false")).toBe(false);
    expect(areDevelopmentToolsEnabled("TRUE")).toBe(false);
    expect(areDevelopmentToolsEnabled("1")).toBe(false);
    expect(areDevelopmentToolsEnabled("")).toBe(false);
  });

  it("blocks an action boundary when the flag is not enabled", () => {
    const previousValue = process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
    delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;

    try {
      expect(() => assertDevelopmentToolsEnabled()).toThrow(
        DevelopmentToolsDisabledError,
      );
    } finally {
      if (previousValue === undefined) {
        delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
      } else {
        process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS = previousValue;
      }
    }
  });
});
