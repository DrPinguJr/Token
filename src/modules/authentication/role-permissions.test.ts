import { describe, expect, it } from "vitest";

import {
  RolePermissionDeniedError,
  assertRolePermission,
  decideRoleAccess,
  hasRolePermission,
} from "./role-permissions";
import type { AuthenticatedSessionReadModel } from "./authenticated-session-read-model";

const vendorSession: AuthenticatedSessionReadModel = {
  account: {
    id: "account-vendor-001",
    displayName: "Courtside Kitchen Team",
    role: "vendor",
  },
  customer: null,
  destination: "/vendor/dashboard",
};

describe("role permissions", () => {
  it("allows only the role capabilities declared by the security matrix", () => {
    expect(hasRolePermission("customer", "purchase:create")).toBe(true);
    expect(hasRolePermission("vendor", "vendor-refund:create")).toBe(false);
    expect(hasRolePermission("staff", "token-issuance:create")).toBe(true);
    expect(hasRolePermission("administrator", "settlement:record")).toBe(true);
    expect(hasRolePermission("administrator", "vendor-refund:create")).toBe(
      true,
    );

    expect(hasRolePermission("customer", "settlement:record")).toBe(false);
    expect(hasRolePermission("vendor", "token-issuance:create")).toBe(false);
    expect(hasRolePermission("staff", "purchase:create")).toBe(false);
  });

  it("throws a stable permission error for a denied service action", () => {
    expect(() =>
      assertRolePermission("staff", "administrative-adjustment:create"),
    ).toThrow(RolePermissionDeniedError);
  });
});

describe("decideRoleAccess", () => {
  it("redirects signed-out and role-mismatched sessions", () => {
    expect(decideRoleAccess(null, ["customer"])).toEqual({
      status: "redirect",
      destination: "/enter",
    });
    expect(decideRoleAccess(vendorSession, ["customer"])).toEqual({
      status: "redirect",
      destination: "/vendor/dashboard",
    });
  });

  it("returns the resolved read model for an allowed role", () => {
    expect(decideRoleAccess(vendorSession, ["vendor"])).toEqual({
      status: "allowed",
      session: vendorSession,
    });
  });
});
