import type { AccountRole } from "@/modules/accounts";

import type { AuthenticatedSessionReadModel } from "./authenticated-session-read-model";

export type RolePermission =
  | "administrative-adjustment:create"
  | "customer-qr:view-own"
  | "customer:search-for-issuance"
  | "event-settings:configure"
  | "purchase:create"
  | "records:inspect"
  | "settlement:record"
  | "token-issuance:create"
  | "vendor-products:manage-own"
  | "vendor-profile:manage-own"
  | "vendor-refund:create-own"
  | "vendor-settlement:view-own"
  | "wallet:view-own";

const permissionsByRole = Object.freeze({
  customer: Object.freeze([
    "customer-qr:view-own",
    "purchase:create",
    "wallet:view-own",
  ]),
  vendor: Object.freeze([
    "vendor-products:manage-own",
    "vendor-profile:manage-own",
    "vendor-refund:create-own",
    "vendor-settlement:view-own",
    "wallet:view-own",
  ]),
  staff: Object.freeze([
    "customer:search-for-issuance",
    "token-issuance:create",
  ]),
  administrator: Object.freeze([
    "administrative-adjustment:create",
    "event-settings:configure",
    "records:inspect",
    "settlement:record",
  ]),
} as const satisfies Record<AccountRole, readonly RolePermission[]>);

export class RolePermissionDeniedError extends Error {
  public readonly code = "ROLE_PERMISSION_DENIED";

  public constructor() {
    super("The current account does not have permission for this action.");
    this.name = "RolePermissionDeniedError";
  }
}

export function hasRolePermission(
  role: AccountRole,
  permission: RolePermission,
): boolean {
  const permissions: readonly RolePermission[] = permissionsByRole[role];
  return permissions.includes(permission);
}

export function assertRolePermission(
  role: AccountRole,
  permission: RolePermission,
): void {
  if (!hasRolePermission(role, permission)) {
    throw new RolePermissionDeniedError();
  }
}

export type RoleAccessDecision =
  | {
      readonly status: "allowed";
      readonly session: AuthenticatedSessionReadModel;
    }
  | {
      readonly status: "redirect";
      readonly destination:
        "/enter" | AuthenticatedSessionReadModel["destination"];
    };

/**
 * A navigation guard for role layouts. It improves local routing but does not
 * replace service-level permission and ownership checks.
 */
export function decideRoleAccess(
  session: AuthenticatedSessionReadModel | null,
  allowedRoles: readonly AccountRole[],
): RoleAccessDecision {
  if (session === null) {
    return { status: "redirect", destination: "/enter" };
  }

  if (!allowedRoles.includes(session.account.role)) {
    return { status: "redirect", destination: session.destination };
  }

  return { status: "allowed", session };
}
