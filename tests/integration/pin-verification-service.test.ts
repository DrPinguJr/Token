import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositories,
} from "@/config/local-repositories";
import { createTokenlySeedData } from "@/config/tokenly-seed-data";
import type { AccountPinCredential } from "@/modules/accounts";
import {
  PIN_LOCK_DURATION_MS,
  PIN_MAX_FAILED_ATTEMPTS,
  PinVerificationService,
  type PinVerificationServiceDependencies,
} from "@/modules/authentication";
import { closeTokenlyDatabaseConnections } from "@/shared/data";

const initialNow = "2026-07-27T04:00:00.000Z";

let databaseNumber = 0;
let databaseName = "";
let repositories: LocalRepositories;
let currentNow = initialNow;
let auditLogNumber = 0;

function createPinVerificationService(
  transactionRunner: PinVerificationServiceDependencies["transactionRunner"] = {
    run: (work) =>
      runInLocalRepositoryTransaction(
        (transactionRepositories) => work(transactionRepositories),
        { databaseName },
      ),
  },
): PinVerificationService {
  return new PinVerificationService({
    idProvider: {
      generateId: () => {
        auditLogNumber += 1;
        return `audit-pin-integration-${auditLogNumber}`;
      },
    },
    clock: {
      now: () => currentNow,
    },
    transactionRunner,
  });
}

async function setCanonicalPinUnconfigured(): Promise<AccountPinCredential> {
  const existingCredential =
    await repositories.accountPinCredentials.getPinCredentialByAccountId(
      "account-customer-001",
    );

  if (existingCredential === null) {
    throw new Error("Canonical PIN integration credential is missing.");
  }

  const unconfiguredCredential: AccountPinCredential = {
    ...existingCredential,
    pinCredential: null,
    failedPinAttempts: 0,
    lockedUntil: null,
  };

  await repositories.accountPinCredentials.updatePinCredential(
    unconfiguredCredential,
  );

  return unconfiguredCredential;
}

beforeEach(async () => {
  databaseNumber += 1;
  databaseName = `tokenly-pin-verification-test-${databaseNumber}`;
  currentNow = initialNow;
  auditLogNumber = 0;
  repositories = await createLocalRepositories({ databaseName });

  const seed = createTokenlySeedData();
  const account = seed.accounts.find(({ id }) => id === "account-customer-001");
  const credential = seed.accountPinCredentials.find(
    ({ accountId }) => accountId === account?.id,
  );

  expect(account).toBeDefined();
  expect(credential).toBeDefined();

  if (account === undefined || credential === undefined) {
    throw new Error("Canonical PIN integration seed account is missing.");
  }

  await repositories.accounts.create(account, credential);
});

afterEach(async () => {
  await repositories.close();
  await deleteDB(databaseName);
  await closeTokenlyDatabaseConnections();
});

describe("PinVerificationService IndexedDB integration", () => {
  it("verifies the canonical seed digest and serializes concurrent lockout attempts", async () => {
    const service = createPinVerificationService();

    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "2468",
      }),
    ).resolves.toEqual({
      status: "verified",
      accountId: "account-customer-001",
    });

    const concurrentResults = await Promise.all(
      Array.from({ length: PIN_MAX_FAILED_ATTEMPTS }, () =>
        service.verifyPin({
          actorAccountId: "account-customer-001",
          pin: "0000",
        }),
      ),
    );
    const expectedLockedUntil = new Date(
      Date.parse(initialNow) + PIN_LOCK_DURATION_MS,
    ).toISOString();

    expect(
      concurrentResults.filter(({ status }) => status === "failed"),
    ).toHaveLength(PIN_MAX_FAILED_ATTEMPTS - 1);
    expect(
      concurrentResults.filter(({ status }) => status === "locked"),
    ).toEqual([
      {
        status: "locked",
        code: "PIN_VERIFICATION_LOCKED",
        message: "PIN verification is temporarily unavailable.",
        lockedUntil: expectedLockedUntil,
      },
    ]);

    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toMatchObject({
      failedPinAttempts: PIN_MAX_FAILED_ATTEMPTS,
      lockedUntil: expectedLockedUntil,
    });
    expect(
      await repositories.auditLogs.list({
        eventType: "pin_verification_failed",
        targetType: "account",
        targetId: "account-customer-001",
      }),
    ).toHaveLength(PIN_MAX_FAILED_ATTEMPTS);

    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "2468",
      }),
    ).resolves.toMatchObject({
      status: "locked",
      lockedUntil: expectedLockedUntil,
    });

    currentNow = expectedLockedUntil;

    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "2468",
      }),
    ).resolves.toEqual({
      status: "verified",
      accountId: "account-customer-001",
    });
    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toMatchObject({
      failedPinAttempts: 0,
      lockedUntil: null,
    });

    await service.verifyPin({
      actorAccountId: "account-customer-001",
      pin: "0000",
    });
    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toMatchObject({
      failedPinAttempts: 1,
      lockedUntil: null,
    });
  });

  it("rolls back a failed-attempt update when the audit append fails", async () => {
    const service = createPinVerificationService({
      run: (work) =>
        runInLocalRepositoryTransaction(
          (transactionRepositories) =>
            work({
              accounts: transactionRepositories.accounts,
              accountPinCredentials:
                transactionRepositories.accountPinCredentials,
              auditLogs: {
                append: async () => {
                  throw new Error("Simulated audit persistence failure.");
                },
              },
            }),
          { databaseName },
        ),
    });

    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "0000",
      }),
    ).rejects.toThrow("Simulated audit persistence failure.");

    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toMatchObject({
      failedPinAttempts: 0,
      lockedUntil: null,
    });
    expect(
      await repositories.auditLogs.list({
        eventType: "pin_verification_failed",
      }),
    ).toEqual([]);
  });

  it("fails verify and change generically for an unconfigured persisted PIN", async () => {
    const unconfiguredCredential = await setCanonicalPinUnconfigured();
    const service = createPinVerificationService();

    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "2468",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_VERIFICATION_FAILED",
      message: "PIN verification failed.",
    });
    await expect(
      service.changePin({
        actorAccountId: "account-customer-001",
        currentPin: "2468",
        newPin: "1357",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_CHANGE_FAILED",
      message: "PIN change failed.",
    });

    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toEqual(unconfiguredCredential);
    expect(await repositories.auditLogs.list()).toEqual([]);
  });

  it("persists only derived setup/change credentials and safe audit metadata", async () => {
    await setCanonicalPinUnconfigured();
    const service = createPinVerificationService();

    await expect(
      service.setupPin({
        actorAccountId: "account-customer-001",
        pin: "1357",
      }),
    ).resolves.toMatchObject({
      status: "setup",
    });
    const firstSetupCredential =
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      );

    await expect(
      service.setupPin({
        actorAccountId: "account-customer-001",
        pin: "0000",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_SETUP_FAILED",
      message: "PIN setup failed.",
    });
    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      ),
    ).toEqual(firstSetupCredential);

    await expect(
      service.changePin({
        actorAccountId: "account-customer-001",
        currentPin: "1357",
        newPin: "8642",
      }),
    ).resolves.toMatchObject({
      status: "changed",
    });
    await expect(
      service.verifyPin({
        actorAccountId: "account-customer-001",
        pin: "8642",
      }),
    ).resolves.toMatchObject({
      status: "verified",
    });

    const credential =
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        "account-customer-001",
      );
    const setupAudits = await repositories.auditLogs.list({
      eventType: "pin_setup",
      targetType: "account",
      targetId: "account-customer-001",
    });
    const serializedPersistence = JSON.stringify({
      credential,
      setupAudits,
    });

    expect(credential?.pinCredential).toMatch(
      /^prototype-sha256-v1\$[a-f0-9]{64}$/,
    );
    expect(setupAudits.map(({ metadata }) => metadata)).toEqual([
      {
        operation: "setup",
        source: "pin_verification_service",
      },
      {
        operation: "change",
        source: "pin_verification_service",
      },
    ]);
    expect(serializedPersistence).not.toContain("1357");
    expect(serializedPersistence).not.toContain("8642");
  });
});
