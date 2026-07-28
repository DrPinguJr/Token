import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  pathname: "/dev/role-switcher",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
}));

import { DevelopmentToolsNavigation } from "./development-tools-navigation";

describe("DevelopmentToolsNavigation", () => {
  beforeEach(() => {
    navigationMocks.pathname = "/dev/role-switcher";
  });

  it("marks the role switcher as the current page", () => {
    render(<DevelopmentToolsNavigation />);

    expect(screen.getByRole("link", { name: "Role switcher" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Local data" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps active-location semantics on a nested data route", () => {
    navigationMocks.pathname = "/dev/data/history";

    render(<DevelopmentToolsNavigation />);

    expect(screen.getByRole("link", { name: "Local data" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
