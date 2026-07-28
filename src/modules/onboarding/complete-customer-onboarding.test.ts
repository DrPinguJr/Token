import { describe, expect, it } from "vitest";

import type { AccountSummary } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";

import {
  CompleteCustomerOnboardingService,
  type CustomerOnboardingTransactionRepositories,
} from "./complete-customer-onboarding";
import { CustomerOnboardingServiceError } from "./customer-onboarding-service-error";

const completedAt = "2026-07-27T08:30:00.000Z";

function createAccount(
  overrides: Partial<AccountSummary> = {},
): AccountSummary {
  return {
    id: "account-customer-003",
    mobileNumber: "90000009",
    displayName: "Noa Swift",
    role: "customer",
    status: "active",
    createdAt: "2026-07-01T01:08:00.000Z",
    updatedAt: "2026-07-01T01:08:00.000Z",
    ...overrides,
  };
}

function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "customer-003",
    accountId: "account-customer-003",
    walletId: "wallet-customer-003",
    publicCode: "cus_9M5T1W7C",
    onboardingCompletedAt: null,
    createdAt: "2026-07-01T01:08:00.000Z",
    updatedAt: "2026-07-01T01:08:00.000Z",
    ...overrides,
  };
}

interface ServiceHarness {
  readonly audits: AuditLog[];
  readonly getCustomer: () => Customer | null;
  readonly getTransactionRunCount: () => number;
  readonly service: CompleteCustomerOnboardingService;
}

function createServiceHarness(options?: {
  readonly account?: AccountSummary | null;
  readonly customer?: Customer | null;
  readonly developmentToolsEnabled?: boolean;
  readonly rejectAudit?: boolean;
}): ServiceHarness {
  let persistedCustomer =
    options?.customer === undefined ? createCustomer() : options.customer;
  const persistedAudits: AuditLog[] = [];
  let transactionRunCount = 0;

  const service = new CompleteCustomerOnboardingService({
    clock: { now: () => completedAt },
    idProvider: {
      generateId: (recordType) => `${recordType}:onboarding-001`,
    },
    isDevelopmentToolsEnabled: () => options?.developmentToolsEnabled ?? false,
    transactionRunner: {
      run: async (work) => {
        transactionRunCount += 1;
        let workingCustomer = persistedCustomer;
        const workingAudits = [...persistedAudits];
        const repositories: CustomerOnboardingTransactionRepositories = {
          accounts: {
            getById: async () =>
              options?.account === undefined
                ? createAccount()
                : options.account,
          },
          customers: {
            getByAccountId: async () => workingCustomer,
            update: async (customer) => {
              workingCustomer = customer;
            },
          },
          auditLogs: {
            append: async (audit) => {
              if (options?.rejectAudit === true) {
                throw new Error("audit unavailable");
              }
              workingAudits.push(audit);
            },
          },
        };

        const result = await work(repositories);
        persistedCustomer = workingCustomer;
        persistedAudits.splice(0, persistedAudits.length, ...workingAudits);
        return result;
      },
    },
  });

  return {
    audits: persistedAudits,
    getCustomer: () => persistedCustomer,
    getTransactionRunCount: () => transactionRunCount,
    service,
  };
}

describe("CompleteCustomerOnboardingService", () => {
  it("atomically completes the customer profile and appends an actor-aware audit", async () => {
    const harness = createServiceHarness();

    await expect(
      harness.service.complete({
        actorAccountId: "account-customer-003",
        completionMethod: "guided",
      }),
    ).resolves.toEqual({
      customerId: "customer-003",
      completedAt,
      status: "completed",
    });

    expect(harness.getCustomer()).toMatchObject({
      onboardingCompletedAt: completedAt,
      updatedAt: completedAt,
    });
    expect(harness.audits).toEqual([
      expect.objectContaining({
        id: "audit-log:onboarding-001",
        eventType: "onboarding_completed",
        actorAccountId: "account-customer-003",
        targetType: "customer",
        targetId: "customer-003",
        metadata: { completionMethod: "guided" },
      }),
    ]);
  });

  it("returns the stored completion without duplicating the audit", async () => {
    const originalCompletion = "2026-07-20T03:00:00.000Z";
    const harness = createServiceHarness({
      customer: createCustomer({ onboardingCompletedAt: originalCompletion }),
    });

    await expect(
      harness.service.complete({
        actorAccountId: "account-customer-003",
        completionMethod: "guided",
      }),
    ).resolves.toEqual({
      customerId: "customer-003",
      completedAt: originalCompletion,
      status: "already-completed",
    });
    expect(harness.audits).toHaveLength(0);
  });

  it.each([
    ["missing", null],
    ["disabled", createAccount({ status: "disabled" })],
    ["vendor", createAccount({ role: "vendor" })],
  ])("rejects a %s account", async (_case, account) => {
    const harness = createServiceHarness({ account });

    await expect(
      harness.service.complete({
        actorAccountId: "account-customer-003",
        completionMethod: "guided",
      }),
    ).rejects.toMatchObject({
      code: "ONBOARDING_ACCOUNT_NOT_AUTHORIZED",
    } satisfies Partial<CustomerOnboardingServiceError>);
    expect(harness.getCustomer()?.onboardingCompletedAt).toBeNull();
  });

  it("rejects development skip before opening a transaction when tools are disabled", async () => {
    const harness = createServiceHarness();

    await expect(
      harness.service.complete({
        actorAccountId: "account-customer-003",
        completionMethod: "development_skip",
      }),
    ).rejects.toMatchObject({
      code: "ONBOARDING_DEVELOPMENT_SKIP_DISABLED",
    } satisfies Partial<CustomerOnboardingServiceError>);
    expect(harness.getTransactionRunCount()).toBe(0);
  });

  it("records an enabled development skip through the same completion path", async () => {
    const harness = createServiceHarness({ developmentToolsEnabled: true });

    await harness.service.complete({
      actorAccountId: "account-customer-003",
      completionMethod: "development_skip",
    });

    expect(harness.getCustomer()?.onboardingCompletedAt).toBe(completedAt);
    expect(harness.audits[0]?.metadata).toEqual({
      completionMethod: "development_skip",
    });
  });

  it("rolls back the profile update when the audit append fails", async () => {
    const harness = createServiceHarness({ rejectAudit: true });

    await expect(
      harness.service.complete({
        actorAccountId: "account-customer-003",
        completionMethod: "guided",
      }),
    ).rejects.toThrow("audit unavailable");
    expect(harness.getCustomer()?.onboardingCompletedAt).toBeNull();
    expect(harness.audits).toHaveLength(0);
  });
});
