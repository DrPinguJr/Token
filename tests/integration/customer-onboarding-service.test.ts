import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createConfiguredCustomerOnboardingService } from "@/config/configured-customer-onboarding-service";
import { resetLocalData } from "@/config/local-data";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
} from "@/config/local-repositories";
import { initializeTokenlyApplicationData } from "@/config/seed-tokenly-local-data";
import {
  CompleteCustomerOnboardingService,
  type CustomerOnboardingTransactionRepositories,
} from "@/modules/onboarding";

const incompleteCustomerAccountId = "account-customer-003";
const incompleteCustomerId = "customer-003";
const rollbackAttemptedAt = "2026-07-27T09:00:00.000Z";

describe("customer onboarding IndexedDB integration", () => {
  beforeEach(async () => {
    await resetLocalData();
    await initializeTokenlyApplicationData({
      now: () => "2026-07-27T08:00:00.000Z",
    });
  });

  afterEach(async () => {
    await resetLocalData();
  });

  it("uses the configured service to persist completion and its audit atomically", async () => {
    const service = createConfiguredCustomerOnboardingService();

    const receipt = await service.complete({
      actorAccountId: incompleteCustomerAccountId,
      completionMethod: "guided",
    });
    const repositories = await createLocalRepositories();
    const customer = await repositories.customers.getById(incompleteCustomerId);
    const audits = await repositories.auditLogs.list({
      eventType: "onboarding_completed",
      targetType: "customer",
      targetId: incompleteCustomerId,
    });

    expect(receipt).toMatchObject({
      customerId: incompleteCustomerId,
      status: "completed",
    });
    expect(customer).toMatchObject({
      onboardingCompletedAt: receipt.completedAt,
      updatedAt: receipt.completedAt,
    });
    expect(audits).toEqual([
      expect.objectContaining({
        actorAccountId: incompleteCustomerAccountId,
        eventType: "onboarding_completed",
        targetId: incompleteCustomerId,
        targetType: "customer",
        metadata: {
          completionMethod: "guided",
        },
      }),
    ]);
    await repositories.close();
  });

  it("rolls back the customer timestamp when the IndexedDB audit append fails", async () => {
    const service = new CompleteCustomerOnboardingService({
      clock: { now: () => rollbackAttemptedAt },
      idProvider: {
        generateId: () => "audit-onboarding-rollback-integration",
      },
      isDevelopmentToolsEnabled: () => false,
      transactionRunner: {
        run: <Result>(
          work: (
            repositories: CustomerOnboardingTransactionRepositories,
          ) => Promise<Result>,
        ) =>
          runInLocalRepositoryTransaction((repositories) =>
            work({
              accounts: repositories.accounts,
              customers: repositories.customers,
              auditLogs: {
                append: async () => {
                  throw new Error("simulated onboarding audit failure");
                },
              },
            }),
          ),
      },
    });

    await expect(
      service.complete({
        actorAccountId: incompleteCustomerAccountId,
        completionMethod: "guided",
      }),
    ).rejects.toThrow("simulated onboarding audit failure");

    const repositories = await createLocalRepositories();
    const customer = await repositories.customers.getById(incompleteCustomerId);
    const audits = await repositories.auditLogs.list({
      eventType: "onboarding_completed",
      targetId: incompleteCustomerId,
    });

    expect(customer?.onboardingCompletedAt).toBeNull();
    expect(customer?.updatedAt).not.toBe(rollbackAttemptedAt);
    expect(audits).toEqual([]);
    await repositories.close();
  });
});
