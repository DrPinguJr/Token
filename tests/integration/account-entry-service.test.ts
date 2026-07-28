import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalData } from "@/config/local-data";
import { runInLocalRepositoryTransaction } from "@/config/local-repositories";
import { initializeTokenlyApplicationData } from "@/config/seed-tokenly-local-data";
import {
  AccountEntryFailedError,
  AccountEntryService,
  type AccountEntryRepositories,
  type AccountEntryTransactionRunner,
} from "@/modules/authentication";

function createTransactionRunner(): AccountEntryTransactionRunner {
  return {
    run<Result>(
      work: (repositories: AccountEntryRepositories) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

describe("local account entry integration", () => {
  beforeEach(async () => {
    await resetLocalData();
    await initializeTokenlyApplicationData({
      now: () => "2026-07-27T00:00:00.000Z",
    });
  });

  afterEach(async () => {
    await resetLocalData();
  });

  it("atomically resolves the seeded super-admin and appends account_entry", async () => {
    const service = new AccountEntryService({
      transactionRunner: createTransactionRunner(),
      generateAuditId: () => "audit-account-entry-integration-001",
      isDevelopmentToolsEnabled: () => false,
      now: () => "2026-07-27T02:00:00.000Z",
    });

    const session = await service.enter({
      username: "AdminLance",
      password: "Lance888!",
    });
    const auditEntries = await runInLocalRepositoryTransaction((repositories) =>
      repositories.auditLogs.list({
        eventType: "account_entry",
        actorAccountId: session.account.id,
      }),
    );

    expect(session.destination).toBe("/admin/dashboard");
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      id: "audit-account-entry-integration-001",
      targetId: session.account.id,
      metadata: {
        entryMethod: "password",
        prototypeSession: true,
      },
    });
  });

  it("does not append an audit record for an unknown account", async () => {
    const service = new AccountEntryService({
      transactionRunner: createTransactionRunner(),
      generateAuditId: () => "audit-account-entry-integration-unknown",
      isDevelopmentToolsEnabled: () => false,
      now: () => "2026-07-27T02:00:00.000Z",
    });

    await expect(
      service.enter({ username: "AdminLance", password: "wrong-password" }),
    ).rejects.toBeInstanceOf(AccountEntryFailedError);

    const auditEntries = await runInLocalRepositoryTransaction((repositories) =>
      repositories.auditLogs.list({ eventType: "account_entry" }),
    );
    expect(auditEntries).toHaveLength(0);
  });
});
