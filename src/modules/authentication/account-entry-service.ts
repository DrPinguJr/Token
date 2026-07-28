import type { AccountRepository, AccountSummary } from "@/modules/accounts";
import { prepareAuditLog, type AuditLogRepository } from "@/modules/audit-logs";
import type { CustomerRepository } from "@/modules/customers";
import { domainIdSchema } from "@/shared/validation";

import {
  createAuthenticatedSessionReadModel,
  type AuthenticatedSessionReadModel,
} from "./authenticated-session-read-model";
import {
  accountEntrySchema,
  type AccountEntryInput,
} from "./mobile-account-entry-schema";

export const ACCOUNT_ENTRY_FAILURE_MESSAGE =
  "We could not enter that account. Check the username and password and try again.";

const seededOperationalCredentials = Object.freeze([
  {
    accountId: "account-admin-001",
    username: "AdminLance",
    password: "Lance888!",
  },
  {
    accountId: "account-vendor-001",
    username: "Vendor1",
    password: "Vendor1",
  },
]);

export class AccountEntryFailedError extends Error {
  public readonly code = "ACCOUNT_ENTRY_FAILED";

  public constructor() {
    super(ACCOUNT_ENTRY_FAILURE_MESSAGE);
    this.name = "AccountEntryFailedError";
  }
}

export class DevelopmentAccountEntryDisabledError extends Error {
  public readonly code = "DEVELOPMENT_ACCOUNT_ENTRY_DISABLED";

  public constructor() {
    super("Development account switching is disabled.");
    this.name = "DevelopmentAccountEntryDisabledError";
  }
}

export interface AccountEntryRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
}

export interface AccountEntryTransactionRunner {
  run<Result>(
    work: (repositories: AccountEntryRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface AccountEntryServiceDependencies {
  readonly transactionRunner: AccountEntryTransactionRunner;
  readonly generateAuditId: () => string;
  readonly isDevelopmentToolsEnabled: () => boolean;
  readonly now: () => string;
}

/**
 * Resolves an active local account and appends its entry audit record before a
 * caller persists a session. Unknown, disabled, and incomplete accounts share
 * one constant-shape failure.
 */
export class AccountEntryService {
  public constructor(
    private readonly dependencies: AccountEntryServiceDependencies,
  ) {}

  public enter(
    input: AccountEntryInput,
  ): Promise<AuthenticatedSessionReadModel> {
    const parsedInput = accountEntrySchema.parse(input);

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const credential =
        seededOperationalCredentials.find(
          (candidate) =>
            candidate.username === parsedInput.username &&
            candidate.password === parsedInput.password,
        ) ?? null;
      const account =
        credential === null
          ? null
          : await repositories.accounts.getById(credential.accountId);

      return this.completeEntry(repositories, account, "password");
    });
  }

  /**
   * Development role switching uses an account ID selected from authoritative
   * seeded records. It creates the same session read model and audit event as
   * credential entry while labelling the simulator entry method accurately.
   */
  public enterDevelopmentAccount(
    accountId: string,
  ): Promise<AuthenticatedSessionReadModel> {
    if (!this.dependencies.isDevelopmentToolsEnabled()) {
      throw new DevelopmentAccountEntryDisabledError();
    }

    const parsedAccountId = domainIdSchema.parse(accountId);

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const account = await repositories.accounts.getById(parsedAccountId);
      return this.completeEntry(
        repositories,
        account,
        "development_role_switcher",
      );
    });
  }

  private async completeEntry(
    repositories: AccountEntryRepositories,
    account: AccountSummary | null,
    entryMethod: "development_role_switcher" | "password",
  ): Promise<AuthenticatedSessionReadModel> {
    if (account === null || account.status !== "active") {
      throw new AccountEntryFailedError();
    }

    const customer =
      account.role === "customer"
        ? await repositories.customers.getByAccountId(account.id)
        : null;

    if (account.role === "customer" && customer === null) {
      throw new AccountEntryFailedError();
    }

    const session = createAuthenticatedSessionReadModel(account, customer);
    const auditLog = prepareAuditLog(
      {
        eventType: "account_entry",
        actorAccountId: account.id,
        targetType: "account",
        targetId: account.id,
        description: "Local prototype account entry recorded.",
        metadata: {
          entryMethod,
          prototypeSession: true,
        },
        transactionGroupId: null,
      },
      {
        id: this.dependencies.generateAuditId(),
        occurredAt: this.dependencies.now(),
      },
    );

    await repositories.auditLogs.append(auditLog);
    return session;
  }
}
