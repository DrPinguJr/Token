import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
}));

import DevelopmentLayout from "./layout";

const originalDevelopmentToolsValue =
  process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;

describe("DevelopmentLayout", () => {
  beforeEach(() => {
    navigationMocks.notFound.mockClear();
  });

  afterEach(() => {
    if (originalDevelopmentToolsValue === undefined) {
      delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
    } else {
      process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS =
        originalDevelopmentToolsValue;
    }
  });

  it("makes every development route unavailable when the flag is disabled", () => {
    process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS = "false";

    expect(() =>
      DevelopmentLayout({ children: <div>Protected tool</div> }),
    ).toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledOnce();
  });

  it("allows the route tree only for the explicit enabled value", () => {
    process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS = "true";

    const result = DevelopmentLayout({
      children: <div>Protected tool</div>,
    });

    expect(result).not.toBeNull();
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
  });
});
