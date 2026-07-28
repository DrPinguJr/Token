import { describe, expect, it } from "vitest";

import type { Account, AccountPinCredential } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";

import {
  pinChangeCommandSchema,
  pinSetupCommandSchema,
  pinVerificationCommandSchema,
  walletPinSchema,
} from "./pin-command-schema";
import {
  PIN_LOCK_DURATION_MS,
  PIN_MAX_FAILED_ATTEMPTS,
  PinVerificationService,
  type PinVerificationTransactionRepositories,
} from "./pin-verification-service";
import {
  constantShapePrototypeCredentialEquals,
  derivePrototypePinCredential,
} from "./prototype-pin-credential";

const initialNow = "2026-07-27T03:00:00.000Z";
const seededPinCredential =
  "prototype-sha256-v1$a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972";

const customerAccount: Account = {
  id: "account-customer-pin-unit",
  mobileNumber: "91111111",
  displayName: "PIN Unit Customer",
  role: "customer",
  status: "active",
  createdAt: initialNow,
  updatedAt: initialNow,
};

const unconfiguredPinCredential: AccountPinCredential = {
  accountId: customerAccount.id,
  pinCredential: null,
  failedPinAttempts: 0,
  lockedUntil: null,
};

interface PinHarnessOptions {
  readonly account?: Account | null;
  readonly credential?: AccountPinCredential | null;
  readonly failAuditAppend?: boolean;
}

interface PinHarness {
  readonly service: PinVerificationService;
  readonly state: {
    account: Account | null;
    auditLogs: AuditLog[];
    credential: AccountPinCredential | null;
    transactionRuns: number;
  };
  setNow(value: string): void;
}

async function createPinHarness(
  options: PinHarnessOptions = {},
): Promise<PinHarness> {
  const initialCredential =
    options.credential === undefined
      ? {
          accountId: customerAccount.id,
          pinCredential: await derivePrototypePinCredential("2468"),
          failedPinAttempts: 0,
          lockedUntil: null,
        }
      : options.credential;
  const state = {
    account: options.account === undefined ? customerAccount : options.account,
    auditLogs: [] as AuditLog[],
    credential: initialCredential,
    transactionRuns: 0,
  };
  let now = initialNow;
  let auditLogNumber = 0;

  const service = new PinVerificationService({
    idProvider: {
      generateId: () => {
        auditLogNumber += 1;
        return `audit-pin-unit-${auditLogNumber}`;
      },
    },
    clock: {
      now: () => now,
    },
    transactionRunner: {
      run: async (work) => {
        state.transactionRuns += 1;
        let transactionalCredential =
          state.credential === null ? null : { ...state.credential };
        const transactionalAuditLogs = [...state.auditLogs];
        const repositories: PinVerificationTransactionRepositories = {
          accounts: {
            getById: async (accountId) =>
              state.account?.id === accountId ? state.account : null,
          },
          accountPinCredentials: {
            getPinCredentialByAccountId: async (accountId) =>
              transactionalCredential?.accountId === accountId
                ? transactionalCredential
                : null,
            updatePinCredential: async (credential) => {
              if (
                transactionalCredential === null ||
                transactionalCredential.accountId !== credential.accountId
              ) {
                throw new Error("PIN credential does not exist.");
              }

              transactionalCredential = credential;
            },
          },
          auditLogs: {
            append: async (entry) => {
              if (options.failAuditAppend === true) {
                throw new Error("Simulated audit append failure.");
              }

              transactionalAuditLogs.push(entry);
            },
          },
        };

        const result = await work(repositories);
        state.credential = transactionalCredential;
        state.auditLogs.splice(
          0,
          state.auditLogs.length,
          ...transactionalAuditLogs,
        );
        return result;
      },
    },
  });

  return {
    service,
    state,
    setNow: (value) => {
      now = value;
    },
  };
}

describe("PIN command schemas", () => {
  it("accepts exactly four ASCII digits and rejects lookalikes or whitespace", () => {
    for (const pin of ["0000", "2468", "9999"]) {
      expect(walletPinSchema.safeParse(pin).success).toBe(true);
    }

    for (const pin of [
      "",
      "123",
      "12345",
      "12a4",
      " 2468",
      "2468 ",
      "２４６８",
      2468,
    ]) {
      expect(walletPinSchema.safeParse(pin).success).toBe(false);
    }

    expect(
      pinVerificationCommandSchema.safeParse({
        actorAccountId: customerAccount.id,
        pin: "2468",
        targetAccountId: "account-other",
      }).success,
    ).toBe(false);
    expect(
      pinSetupCommandSchema.safeParse({
        actorAccountId: customerAccount.id,
        pin: "1357",
      }).success,
    ).toBe(true);
    expect(
      pinChangeCommandSchema.safeParse({
        actorAccountId: customerAccount.id,
        currentPin: "2468",
        newPin: "1357",
      }).success,
    ).toBe(true);
  });
});

describe("prototype PIN credentials", () => {
  it("derives the credential format used by deterministic seed data", async () => {
    const derivedCredential = await derivePrototypePinCredential("2468");

    expect(derivedCredential).toBe(seededPinCredential);
    expect(derivedCredential).toMatch(/^prototype-sha256-v1\$[a-f0-9]{64}$/);
    expect(
      constantShapePrototypeCredentialEquals(
        derivedCredential,
        seededPinCredential,
      ),
    ).toBe(true);
    expect(
      constantShapePrototypeCredentialEquals(
        derivedCredential,
        `${seededPinCredential}0`,
      ),
    ).toBe(false);
    expect(
      constantShapePrototypeCredentialEquals(
        derivedCredential,
        seededPinCredential.slice(0, -1),
      ),
    ).toBe(false);
  });
});

describe("PinVerificationService", () => {
  it("verifies the actor-bound seed PIN and resets prior failure state", async () => {
    const harness = await createPinHarness({
      credential: {
        accountId: customerAccount.id,
        pinCredential: seededPinCredential,
        failedPinAttempts: 3,
        lockedUntil: null,
      },
    });

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "2468",
      }),
    ).resolves.toEqual({
      status: "verified",
      accountId: customerAccount.id,
    });

    expect(harness.state.credential).toEqual({
      accountId: customerAccount.id,
      pinCredential: seededPinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
    });
    expect(harness.state.auditLogs).toEqual([]);
  });

  it("returns the same generic result for a wrong PIN and an unknown actor", async () => {
    const knownHarness = await createPinHarness();
    const unknownHarness = await createPinHarness({
      account: null,
      credential: null,
    });
    const wrongResult = await knownHarness.service.verifyPin({
      actorAccountId: customerAccount.id,
      pin: "0000",
    });
    const unknownResult = await unknownHarness.service.verifyPin({
      actorAccountId: customerAccount.id,
      pin: "0000",
    });

    expect(wrongResult).toEqual({
      status: "failed",
      code: "PIN_VERIFICATION_FAILED",
      message: "PIN verification failed.",
    });
    expect(unknownResult).toEqual(wrongResult);
    expect(knownHarness.state.credential?.failedPinAttempts).toBe(1);
    expect(unknownHarness.state.auditLogs).toEqual([]);
  });

  it("rejects malformed input generically without opening a transaction", async () => {
    const harness = await createPinHarness();

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "24680",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_VERIFICATION_FAILED",
      message: "PIN verification failed.",
    });

    expect(harness.state.transactionRuns).toBe(0);
    expect(harness.state.credential?.failedPinAttempts).toBe(0);
  });

  it("audits each failed attempt without attempted or stored credential data", async () => {
    const harness = await createPinHarness();

    await harness.service.verifyPin({
      actorAccountId: customerAccount.id,
      pin: "0000",
    });

    expect(harness.state.auditLogs).toEqual([
      {
        id: "audit-pin-unit-1",
        eventType: "pin_verification_failed",
        actorAccountId: customerAccount.id,
        targetType: "account",
        targetId: customerAccount.id,
        description: "PIN verification failed.",
        occurredAt: initialNow,
        metadata: {
          source: "pin_verification_service",
        },
        transactionGroupId: null,
      },
    ]);

    const serializedAudit = JSON.stringify(harness.state.auditLogs);
    expect(serializedAudit).not.toContain("0000");
    expect(serializedAudit).not.toContain("2468");
    expect(serializedAudit).not.toContain("prototype-sha256");
    expect(serializedAudit.toLowerCase()).not.toContain("credential");
  });

  it("locks on the fifth failure for five minutes and unlocks at the boundary", async () => {
    const harness = await createPinHarness();
    const expectedLockedUntil = new Date(
      Date.parse(initialNow) + PIN_LOCK_DURATION_MS,
    ).toISOString();

    for (let attempt = 1; attempt < PIN_MAX_FAILED_ATTEMPTS; attempt += 1) {
      await expect(
        harness.service.verifyPin({
          actorAccountId: customerAccount.id,
          pin: "0000",
        }),
      ).resolves.toMatchObject({
        status: "failed",
        code: "PIN_VERIFICATION_FAILED",
      });
    }

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "0000",
      }),
    ).resolves.toEqual({
      status: "locked",
      code: "PIN_VERIFICATION_LOCKED",
      message: "PIN verification is temporarily unavailable.",
      lockedUntil: expectedLockedUntil,
    });
    expect(harness.state.credential).toMatchObject({
      failedPinAttempts: PIN_MAX_FAILED_ATTEMPTS,
      lockedUntil: expectedLockedUntil,
    });
    expect(harness.state.auditLogs).toHaveLength(PIN_MAX_FAILED_ATTEMPTS);

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "2468",
      }),
    ).resolves.toMatchObject({
      status: "locked",
      lockedUntil: expectedLockedUntil,
    });
    expect(harness.state.auditLogs).toHaveLength(PIN_MAX_FAILED_ATTEMPTS);

    harness.setNow(expectedLockedUntil);

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "2468",
      }),
    ).resolves.toMatchObject({
      status: "verified",
      accountId: customerAccount.id,
    });
    expect(harness.state.credential).toMatchObject({
      failedPinAttempts: 0,
      lockedUntil: null,
    });
  });

  it("starts a fresh attempt window after an expired lock", async () => {
    const expiredAt = "2026-07-27T02:59:59.999Z";
    const harness = await createPinHarness({
      credential: {
        accountId: customerAccount.id,
        pinCredential: seededPinCredential,
        failedPinAttempts: PIN_MAX_FAILED_ATTEMPTS,
        lockedUntil: expiredAt,
      },
    });

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "0000",
      }),
    ).resolves.toMatchObject({
      status: "failed",
    });
    expect(harness.state.credential).toMatchObject({
      failedPinAttempts: 1,
      lockedUntil: null,
    });
  });

  it("sets an unconfigured PIN once and refuses repeat setup without mutation", async () => {
    const harness = await createPinHarness({
      credential: unconfiguredPinCredential,
    });

    await expect(
      harness.service.setupPin({
        actorAccountId: customerAccount.id,
        pin: "1357",
      }),
    ).resolves.toEqual({
      status: "setup",
      accountId: customerAccount.id,
    });
    expect(harness.state.credential?.pinCredential).toBe(
      await derivePrototypePinCredential("1357"),
    );
    expect(harness.state.auditLogs.at(-1)).toMatchObject({
      eventType: "pin_setup",
      metadata: {
        operation: "setup",
        source: "pin_verification_service",
      },
    });
    const configuredCredential = harness.state.credential;
    const setupAudits = [...harness.state.auditLogs];

    await expect(
      harness.service.setupPin({
        actorAccountId: customerAccount.id,
        pin: "8642",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_SETUP_FAILED",
      message: "PIN setup failed.",
    });

    expect(harness.state.credential).toEqual(configuredCredential);
    expect(harness.state.auditLogs).toEqual(setupAudits);
  });

  it("changes a configured PIN with a safe audit", async () => {
    const harness = await createPinHarness();

    await expect(
      harness.service.changePin({
        actorAccountId: customerAccount.id,
        currentPin: "2468",
        newPin: "8642",
      }),
    ).resolves.toEqual({
      status: "changed",
      accountId: customerAccount.id,
    });
    expect(harness.state.credential?.pinCredential).toBe(
      await derivePrototypePinCredential("8642"),
    );
    expect(harness.state.auditLogs.at(-1)).toMatchObject({
      eventType: "pin_setup",
      metadata: {
        operation: "change",
        source: "pin_verification_service",
      },
    });

    const serializedState = JSON.stringify(harness.state);
    expect(serializedState).not.toContain("8642");
  });

  it("fails verify and change generically for an unconfigured PIN without mutation", async () => {
    const harness = await createPinHarness({
      credential: unconfiguredPinCredential,
    });

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "2468",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_VERIFICATION_FAILED",
      message: "PIN verification failed.",
    });
    await expect(
      harness.service.changePin({
        actorAccountId: customerAccount.id,
        currentPin: "2468",
        newPin: "1357",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_CHANGE_FAILED",
      message: "PIN change failed.",
    });

    expect(harness.state.credential).toEqual(unconfiguredPinCredential);
    expect(harness.state.auditLogs).toEqual([]);
  });

  it("limits PIN setup and change to active customer/vendor actors", async () => {
    for (const account of [
      { ...customerAccount, status: "disabled" as const },
      { ...customerAccount, role: "staff" as const },
      { ...customerAccount, role: "administrator" as const },
    ]) {
      const harness = await createPinHarness({ account });
      const originalCredential = harness.state.credential;

      await expect(
        harness.service.setupPin({
          actorAccountId: account.id,
          pin: "1357",
        }),
      ).resolves.toMatchObject({
        status: "failed",
        code: "PIN_SETUP_FAILED",
      });
      await expect(
        harness.service.changePin({
          actorAccountId: account.id,
          currentPin: "2468",
          newPin: "1357",
        }),
      ).resolves.toMatchObject({
        status: "failed",
        code: "PIN_CHANGE_FAILED",
      });

      expect(harness.state.credential).toEqual(originalCredential);
      expect(harness.state.auditLogs).toEqual([]);
    }

    const vendorHarness = await createPinHarness({
      account: {
        ...customerAccount,
        role: "vendor",
      },
      credential: unconfiguredPinCredential,
    });

    await expect(
      vendorHarness.service.setupPin({
        actorAccountId: customerAccount.id,
        pin: "1357",
      }),
    ).resolves.toMatchObject({
      status: "setup",
    });
  });

  it("counts a wrong current PIN and keeps change failures generic", async () => {
    const harness = await createPinHarness();

    await expect(
      harness.service.changePin({
        actorAccountId: customerAccount.id,
        currentPin: "0000",
        newPin: "1357",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "PIN_CHANGE_FAILED",
      message: "PIN change failed.",
    });

    expect(harness.state.credential).toMatchObject({
      pinCredential: seededPinCredential,
      failedPinAttempts: 1,
    });
    expect(harness.state.auditLogs).toHaveLength(1);
    expect(harness.state.auditLogs[0]?.eventType).toBe(
      "pin_verification_failed",
    );
  });

  it("rolls back the failure counter when its audit append fails", async () => {
    const harness = await createPinHarness({ failAuditAppend: true });

    await expect(
      harness.service.verifyPin({
        actorAccountId: customerAccount.id,
        pin: "0000",
      }),
    ).rejects.toThrow("Simulated audit append failure.");

    expect(harness.state.credential).toMatchObject({
      failedPinAttempts: 0,
      lockedUntil: null,
    });
    expect(harness.state.auditLogs).toEqual([]);
  });
});
