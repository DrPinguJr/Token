import { describe, expect, it, vi } from "vitest";

import type { AccountSummary } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";

import {
  ACCOUNT_ENTRY_FAILURE_MESSAGE,
  AccountEntryFailedError,
  AccountEntryService,
  type AccountEntryRepositories,
  type AccountEntryTransactionRunner,
} from "./account-entry-service";

const createdAt = "2026-07-01T01:00:00.000Z";

function createAccount(
  overrides: Partial<AccountSummary> = {},
): AccountSummary {
  return {
    id: "account-customer-001",
    mobileNumber: "90000001",
    displayName: "Ari Rally",
    role: "customer",
    status: "active",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "customer-001",
    accountId: "account-customer-001",
    walletId: "wallet-customer-001",
    publicCode: "customer-code-001",
    onboardingCompletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

interface TestContext {
  readonly service: AccountEntryService;
  readonly audits: AuditLog[];
}

function createTestContext(
  accounts: readonly AccountSummary[],
  customers: readonly Customer[] = [],
  appendAudit: (entry: AuditLog) => Promise<void> = async () => undefined,
  isDevelopmentToolsEnabled = true,
): TestContext {
  const audits: AuditLog[] = [];
  const repositories: AccountEntryRepositories = {
    accounts: {
      getById: async (id) =>
        accounts.find((account) => account.id === id) ?? null,
      getByMobileNumber: async (mobileNumber) =>
        accounts.find((account) => account.mobileNumber === mobileNumber) ??
        null,
    },
    customers: {
      getByAccountId: async (accountId) =>
        customers.find((customer) => customer.accountId === accountId) ?? null,
    },
    auditLogs: {
      append: async (entry) => {
        await appendAudit(entry);
        audits.push(entry);
      },
    },
  };
  const transactionRunner: AccountEntryTransactionRunner = {
    run<Result>(
      work: (
        transactionRepositories: AccountEntryRepositories,
      ) => Promise<Result>,
    ): Promise<Result> {
      return work(repositories);
    },
  };

  return {
    audits,
    service: new AccountEntryService({
      transactionRunner,
      generateAuditId: () => "audit-account-entry-001",
      isDevelopmentToolsEnabled: () => isDevelopmentToolsEnabled,
      now: () => "2026-07-27T02:00:00.000Z",
    }),
  };
}

describe("AccountEntryService", () => {
  it("normalizes mobile input, resolves incomplete customer onboarding, and audits safely", async () => {
    const account = createAccount();
    const customer = createCustomer();
    const { service, audits } = createTestContext([account], [customer]);

    const session = await service.enter({
      mobileNumber: "+65 9000-0001",
    });

    expect(session).toEqual({
      account: {
        id: account.id,
        displayName: account.displayName,
        role: "customer",
      },
      customer: {
        id: customer.id,
        walletId: customer.walletId,
        onboardingCompletedAt: null,
      },
      destination: "/customer/onboarding",
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      eventType: "account_entry",
      actorAccountId: account.id,
      targetType: "account",
      targetId: account.id,
      metadata: {
        entryMethod: "mobile_number",
        mobileNumberVerified: false,
        prototypeSession: true,
      },
    });
    expect(JSON.stringify(audits[0])).not.toContain("90000001");
  });

  it("routes completed customers and each operational role correctly", async () => {
    const cases = [
      {
        account: createAccount(),
        customers: [
          createCustomer({
            onboardingCompletedAt: "2026-07-05T02:00:00.000Z",
          }),
        ],
        destination: "/customer",
      },
      {
        account: createAccount({
          id: "account-vendor-001",
          mobileNumber: "90000002",
          displayName: "Courtside Kitchen Team",
          role: "vendor",
        }),
        customers: [],
        destination: "/vendor/dashboard",
      },
      {
        account: createAccount({
          id: "account-staff-001",
          mobileNumber: "90000003",
          displayName: "Jordan Serve",
          role: "staff",
        }),
        customers: [],
        destination: "/staff/dashboard",
      },
      {
        account: createAccount({
          id: "account-admin-001",
          mobileNumber: "90000004",
          displayName: "Morgan Control",
          role: "administrator",
        }),
        customers: [],
        destination: "/admin/dashboard",
      },
    ] as const;

    for (const testCase of cases) {
      const { service } = createTestContext(
        [testCase.account],
        testCase.customers,
      );

      await expect(
        service.enter({
          mobileNumber: testCase.account.mobileNumber,
        }),
      ).resolves.toMatchObject({
        destination: testCase.destination,
      });
    }
  });

  it("uses the same generic error for unknown, disabled, and incomplete accounts", async () => {
    const disabledAccount = createAccount({ status: "disabled" });
    const activeAccount = createAccount({
      id: "account-customer-002",
      mobileNumber: "90000005",
    });
    const { service } = createTestContext([disabledAccount, activeAccount]);

    for (const mobileNumber of ["90000009", "90000001", "90000005"]) {
      await expect(service.enter({ mobileNumber })).rejects.toMatchObject({
        name: "AccountEntryFailedError",
        code: "ACCOUNT_ENTRY_FAILED",
        message: ACCOUNT_ENTRY_FAILURE_MESSAGE,
      });
    }
  });

  it("does not return a successful entry when its audit append fails", async () => {
    const account = createAccount({ role: "staff" });
    const { service } = createTestContext(
      [account],
      [],
      vi.fn(async () => {
        throw new Error("Audit storage failed");
      }),
    );

    await expect(
      service.enter({ mobileNumber: account.mobileNumber }),
    ).rejects.toThrow("Audit storage failed");
  });

  it("audits a development switch with its actual simulator method", async () => {
    const account = createAccount({ role: "staff" });
    const { service, audits } = createTestContext([account]);

    await service.enterDevelopmentAccount(account.id);

    expect(audits[0]?.metadata).toMatchObject({
      entryMethod: "development_role_switcher",
      prototypeSession: true,
    });
  });

  it("blocks development switching before account lookup or audit when disabled", () => {
    const transactionRun = vi.fn();
    const service = new AccountEntryService({
      transactionRunner: {
        run<Result>(): Promise<Result> {
          transactionRun();
          return Promise.reject(new Error("The transaction must not start."));
        },
      },
      generateAuditId: vi.fn(() => "audit-must-not-be-generated"),
      isDevelopmentToolsEnabled: () => false,
      now: vi.fn(() => "2026-07-27T02:00:00.000Z"),
    });

    expect(() =>
      service.enterDevelopmentAccount("account-vendor-001"),
    ).toThrowError(
      expect.objectContaining({
        code: "DEVELOPMENT_ACCOUNT_ENTRY_DISABLED",
        message: "Development account switching is disabled.",
      }),
    );
    expect(transactionRun).not.toHaveBeenCalled();
  });

  it("exposes no lookup-specific detail from its generic error", () => {
    const error = new AccountEntryFailedError();

    expect(error.message).toBe(ACCOUNT_ENTRY_FAILURE_MESSAGE);
    expect(error).not.toHaveProperty("mobileNumber");
    expect(error).not.toHaveProperty("accountId");
  });
});
