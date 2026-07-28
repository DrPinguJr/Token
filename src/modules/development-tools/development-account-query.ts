import type { AccountRepository, AccountRole } from "@/modules/accounts";

export interface DevelopmentAccountReadModel {
  readonly id: string;
  readonly displayName: string;
  readonly mobileNumber: string;
  readonly role: AccountRole;
}

export interface DevelopmentAccountQueryDependencies {
  readonly accounts: Pick<AccountRepository, "list">;
  readonly isDevelopmentToolsEnabled: () => boolean;
}

export class DevelopmentAccountQueryDisabledError extends Error {
  public readonly code = "DEVELOPMENT_ACCOUNT_QUERY_DISABLED";

  public constructor() {
    super("Development account discovery is disabled.");
    this.name = "DevelopmentAccountQueryDisabledError";
  }
}

const roleOrder = {
  customer: 0,
  vendor: 1,
  staff: 2,
  administrator: 3,
} as const satisfies Record<AccountRole, number>;

/**
 * Environment-gated read boundary for the role-switch simulator.
 *
 * Repository records stay behind this query; callers receive only the
 * credential-free fields required by the development UI.
 */
export class DevelopmentAccountQuery {
  public constructor(
    private readonly dependencies: DevelopmentAccountQueryDependencies,
  ) {}

  public async listActiveAccounts(): Promise<
    readonly DevelopmentAccountReadModel[]
  > {
    if (!this.dependencies.isDevelopmentToolsEnabled()) {
      throw new DevelopmentAccountQueryDisabledError();
    }

    const accounts = await this.dependencies.accounts.list({
      status: "active",
    });
    const readModels = accounts.map((account) =>
      Object.freeze({
        id: account.id,
        displayName: account.displayName,
        mobileNumber: account.mobileNumber,
        role: account.role,
      }),
    );

    readModels.sort(
      (left, right) =>
        roleOrder[left.role] - roleOrder[right.role] ||
        left.displayName.localeCompare(right.displayName) ||
        left.id.localeCompare(right.id),
    );

    return Object.freeze(readModels);
  }
}
