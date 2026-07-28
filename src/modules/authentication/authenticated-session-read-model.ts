import type {
  AccountRepository,
  AccountRole,
  AccountSummary,
} from "@/modules/accounts";
import type { Customer, CustomerRepository } from "@/modules/customers";
import { domainIdSchema } from "@/shared/validation";

export const roleDestinations = Object.freeze({
  customer: "/customer",
  vendor: "/vendor/dashboard",
  staff: "/staff/dashboard",
  administrator: "/admin/dashboard",
} as const satisfies Record<AccountRole, string>);

export type AuthenticatedRoleDestination =
  (typeof roleDestinations)[AccountRole] | "/customer/onboarding";

export interface AuthenticatedAccountReadModel {
  readonly id: string;
  readonly displayName: string;
  readonly role: AccountRole;
}

export interface AuthenticatedCustomerReadModel {
  readonly id: string;
  readonly walletId: string;
  readonly onboardingCompletedAt: string | null;
}

export interface AuthenticatedSessionReadModel {
  readonly account: AuthenticatedAccountReadModel;
  readonly customer: AuthenticatedCustomerReadModel | null;
  readonly destination: AuthenticatedRoleDestination;
}

export interface AuthenticatedSessionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
}

export class SessionAccountDataError extends Error {
  public readonly code = "SESSION_ACCOUNT_DATA_INVALID";

  public constructor() {
    super("The local account cannot be used for a session.");
    this.name = "SessionAccountDataError";
  }
}

export class SessionAccountUnavailableError extends Error {
  public readonly code = "SESSION_ACCOUNT_UNAVAILABLE";

  public constructor() {
    super("That local account is unavailable.");
    this.name = "SessionAccountUnavailableError";
  }
}

export function getRoleDestination(
  account: Pick<AccountSummary, "role">,
  customer: Pick<Customer, "onboardingCompletedAt"> | null,
): AuthenticatedRoleDestination {
  if (account.role !== "customer") {
    return roleDestinations[account.role];
  }

  if (customer === null) {
    throw new SessionAccountDataError();
  }

  return customer.onboardingCompletedAt === null
    ? "/customer/onboarding"
    : roleDestinations.customer;
}

export function createAuthenticatedSessionReadModel(
  account: AccountSummary,
  customer: Customer | null,
): AuthenticatedSessionReadModel {
  if (
    (account.role === "customer" && customer?.accountId !== account.id) ||
    (account.role !== "customer" && customer !== null)
  ) {
    throw new SessionAccountDataError();
  }

  return Object.freeze({
    account: Object.freeze({
      id: account.id,
      displayName: account.displayName,
      role: account.role,
    }),
    customer:
      customer === null
        ? null
        : Object.freeze({
            id: customer.id,
            walletId: customer.walletId,
            onboardingCompletedAt: customer.onboardingCompletedAt,
          }),
    destination: getRoleDestination(account, customer),
  });
}

/**
 * Resolves a user-editable local session against authoritative repository
 * records. Invalid, disabled, or structurally incomplete accounts are treated
 * as signed out.
 */
export async function resolveAuthenticatedSessionReadModel(
  accountId: string,
  repositories: AuthenticatedSessionRepositories,
): Promise<AuthenticatedSessionReadModel | null> {
  const parsedAccountId = domainIdSchema.safeParse(accountId);
  if (!parsedAccountId.success) {
    return null;
  }

  const account = await repositories.accounts.getById(parsedAccountId.data);
  if (account === null || account.status !== "active") {
    return null;
  }

  const customer =
    account.role === "customer"
      ? await repositories.customers.getByAccountId(account.id)
      : null;

  if (account.role === "customer" && customer === null) {
    return null;
  }

  return createAuthenticatedSessionReadModel(account, customer);
}
