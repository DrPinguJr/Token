import type {
  Account,
  AccountPinCredential,
  AccountPinCredentialRepository,
  AccountRepository,
} from "@/modules/accounts";
import {
  prepareAuditLog,
  type AuditLog,
  type AuditLogRepository,
} from "@/modules/audit-logs";
import type {
  RepositoryTransactionRunner,
  TransactionClock,
  TransactionIdProvider,
} from "@/modules/transactions";
import { utcTimestampSchema } from "@/shared/validation";

import {
  pinChangeCommandSchema,
  pinSetupCommandSchema,
  pinVerificationCommandSchema,
} from "./pin-command-schema";
import {
  constantShapePrototypeCredentialEquals,
  derivePrototypePinCredential,
  dummyPrototypePinCredential,
} from "./prototype-pin-credential";

export const PIN_MAX_FAILED_ATTEMPTS = 5;
export const PIN_LOCK_DURATION_MS = 5 * 60 * 1_000;

const genericVerificationFailure = Object.freeze({
  status: "failed",
  code: "PIN_VERIFICATION_FAILED",
  message: "PIN verification failed.",
} as const);

const genericPinSetupFailure = Object.freeze({
  status: "failed",
  code: "PIN_SETUP_FAILED",
  message: "PIN setup failed.",
} as const);

const genericPinChangeFailure = Object.freeze({
  status: "failed",
  code: "PIN_CHANGE_FAILED",
  message: "PIN change failed.",
} as const);

export type PinVerificationFailure = typeof genericVerificationFailure;
export type PinSetupFailure = typeof genericPinSetupFailure;
export type PinChangeFailure = typeof genericPinChangeFailure;

export interface PinLockedResult {
  readonly status: "locked";
  readonly code: "PIN_VERIFICATION_LOCKED";
  readonly message: "PIN verification is temporarily unavailable.";
  readonly lockedUntil: string;
}

export interface PinVerifiedResult {
  readonly status: "verified";
  readonly accountId: string;
}

export interface PinSetupSuccess {
  readonly status: "setup";
  readonly accountId: string;
}

export interface PinChangeSuccess {
  readonly status: "changed";
  readonly accountId: string;
}

export type PinVerificationResult =
  PinVerifiedResult | PinVerificationFailure | PinLockedResult;
export type PinSetupResult = PinSetupSuccess | PinSetupFailure;
export type PinChangeResult =
  PinChangeSuccess | PinChangeFailure | PinLockedResult;

export interface PinVerificationTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly accountPinCredentials: Pick<
    AccountPinCredentialRepository,
    "getPinCredentialByAccountId" | "updatePinCredential"
  >;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
}

export interface PinVerificationServiceDependencies {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly transactionRunner: RepositoryTransactionRunner<PinVerificationTransactionRepositories>;
}

interface PinOperationTime {
  readonly occurredAt: string;
  readonly epochMilliseconds: number;
}

interface LoadedPinContext {
  readonly account: Account | null;
  readonly credential: AccountPinCredential | null;
  readonly credentialMatches: boolean;
}

function isPinEligibleAccount(
  account: Account | null,
  actorAccountId: string,
): account is Account {
  return (
    account !== null &&
    account.id === actorAccountId &&
    account.status === "active" &&
    (account.role === "customer" || account.role === "vendor")
  );
}

function isActorBoundCredential(
  credential: AccountPinCredential | null,
  actorAccountId: string,
): credential is AccountPinCredential {
  return credential !== null && credential.accountId === actorAccountId;
}

function isConfiguredPinCredential(
  credential: AccountPinCredential,
): credential is AccountPinCredential & { readonly pinCredential: string } {
  return credential.pinCredential !== null;
}

function getPinOperationTime(clock: TransactionClock): PinOperationTime {
  const occurredAt = utcTimestampSchema.parse(clock.now());

  return Object.freeze({
    occurredAt,
    epochMilliseconds: Date.parse(occurredAt),
  });
}

function createLockedUntil(epochMilliseconds: number): string {
  return new Date(epochMilliseconds + PIN_LOCK_DURATION_MS).toISOString();
}

function createLockedResult(lockedUntil: string): PinLockedResult {
  return Object.freeze({
    status: "locked",
    code: "PIN_VERIFICATION_LOCKED",
    message: "PIN verification is temporarily unavailable.",
    lockedUntil,
  });
}

function isActiveLock(
  credential: AccountPinCredential,
  epochMilliseconds: number,
): credential is AccountPinCredential & { readonly lockedUntil: string } {
  return (
    credential.lockedUntil !== null &&
    Date.parse(credential.lockedUntil) > epochMilliseconds
  );
}

function createFailedCredential(
  credential: AccountPinCredential,
  operationTime: PinOperationTime,
): AccountPinCredential {
  const lockExpired =
    credential.lockedUntil !== null &&
    Date.parse(credential.lockedUntil) <= operationTime.epochMilliseconds;
  const previousAttempts = lockExpired ? 0 : credential.failedPinAttempts;
  const failedPinAttempts = Math.min(
    previousAttempts + 1,
    PIN_MAX_FAILED_ATTEMPTS,
  );

  return Object.freeze({
    ...credential,
    failedPinAttempts,
    lockedUntil:
      failedPinAttempts >= PIN_MAX_FAILED_ATTEMPTS
        ? createLockedUntil(operationTime.epochMilliseconds)
        : null,
  });
}

function createSuccessfulCredential(
  credential: AccountPinCredential,
  pinCredential: string,
): AccountPinCredential {
  return Object.freeze({
    ...credential,
    pinCredential,
    failedPinAttempts: 0,
    lockedUntil: null,
  });
}

function createFailedVerificationAudit(
  auditLogId: string,
  actorAccountId: string,
  occurredAt: string,
): AuditLog {
  return prepareAuditLog(
    {
      eventType: "pin_verification_failed",
      actorAccountId,
      targetType: "account",
      targetId: actorAccountId,
      description: "PIN verification failed.",
      metadata: {
        source: "pin_verification_service",
      },
      transactionGroupId: null,
    },
    {
      id: auditLogId,
      occurredAt,
    },
  );
}

function createPinSetupAudit(
  auditLogId: string,
  actorAccountId: string,
  occurredAt: string,
  operation: "change" | "setup",
): AuditLog {
  return prepareAuditLog(
    {
      eventType: "pin_setup",
      actorAccountId,
      targetType: "account",
      targetId: actorAccountId,
      description: "Account PIN set for the local prototype.",
      metadata: {
        operation,
        source: "pin_verification_service",
      },
      transactionGroupId: null,
    },
    {
      id: auditLogId,
      occurredAt,
    },
  );
}

async function loadPinContext(
  repositories: PinVerificationTransactionRepositories,
  actorAccountId: string,
  derivedPinCredential: string,
): Promise<LoadedPinContext> {
  const [account, credential] = await Promise.all([
    repositories.accounts.getById(actorAccountId),
    repositories.accountPinCredentials.getPinCredentialByAccountId(
      actorAccountId,
    ),
  ]);
  const storedCredential =
    credential?.pinCredential ?? dummyPrototypePinCredential;

  return Object.freeze({
    account,
    credential,
    credentialMatches: constantShapePrototypeCredentialEquals(
      derivedPinCredential,
      storedCredential,
    ),
  });
}

async function recordFailedVerification(
  repositories: PinVerificationTransactionRepositories,
  credential: AccountPinCredential,
  auditLog: AuditLog,
  operationTime: PinOperationTime,
): Promise<PinLockedResult | null> {
  const failedCredential = createFailedCredential(credential, operationTime);

  await repositories.accountPinCredentials.updatePinCredential(
    failedCredential,
  );
  await repositories.auditLogs.append(auditLog);

  return failedCredential.lockedUntil === null
    ? null
    : createLockedResult(failedCredential.lockedUntil);
}

/**
 * Browser-local PIN simulation.
 *
 * Plain-text PINs are parsed and digested before the repository transaction;
 * the transaction closure captures only derived credentials. Wrong attempts
 * update lockout state and append their audit record in the same unit of work.
 * Production must replace this service with server-side password hashing,
 * rate limiting, recovery controls, and monitoring.
 */
export class PinVerificationService {
  public constructor(
    private readonly dependencies: PinVerificationServiceDependencies,
  ) {}

  public async verifyPin(input: unknown): Promise<PinVerificationResult> {
    const parsedCommand = pinVerificationCommandSchema.safeParse(input);

    if (!parsedCommand.success) {
      return genericVerificationFailure;
    }

    const { actorAccountId } = parsedCommand.data;
    const derivedPinCredential = await derivePrototypePinCredential(
      parsedCommand.data.pin,
    );
    const operationTime = getPinOperationTime(this.dependencies.clock);
    const failedAudit = createFailedVerificationAudit(
      this.dependencies.idProvider.generateId("audit-log"),
      actorAccountId,
      operationTime.occurredAt,
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const context = await loadPinContext(
        repositories,
        actorAccountId,
        derivedPinCredential,
      );

      if (
        !isPinEligibleAccount(context.account, actorAccountId) ||
        !isActorBoundCredential(context.credential, actorAccountId)
      ) {
        return genericVerificationFailure;
      }

      if (!isConfiguredPinCredential(context.credential)) {
        return genericVerificationFailure;
      }

      if (isActiveLock(context.credential, operationTime.epochMilliseconds)) {
        return createLockedResult(context.credential.lockedUntil);
      }

      if (!context.credentialMatches) {
        const lockedResult = await recordFailedVerification(
          repositories,
          context.credential,
          failedAudit,
          operationTime,
        );

        return lockedResult ?? genericVerificationFailure;
      }

      await repositories.accountPinCredentials.updatePinCredential(
        createSuccessfulCredential(
          context.credential,
          context.credential.pinCredential,
        ),
      );

      return Object.freeze({
        status: "verified",
        accountId: context.account.id,
      });
    });
  }

  public async setupPin(input: unknown): Promise<PinSetupResult> {
    const parsedCommand = pinSetupCommandSchema.safeParse(input);

    if (!parsedCommand.success) {
      return genericPinSetupFailure;
    }

    const { actorAccountId } = parsedCommand.data;
    const derivedPinCredential = await derivePrototypePinCredential(
      parsedCommand.data.pin,
    );
    const operationTime = getPinOperationTime(this.dependencies.clock);
    const setupAudit = createPinSetupAudit(
      this.dependencies.idProvider.generateId("audit-log"),
      actorAccountId,
      operationTime.occurredAt,
      "setup",
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const [account, credential] = await Promise.all([
        repositories.accounts.getById(actorAccountId),
        repositories.accountPinCredentials.getPinCredentialByAccountId(
          actorAccountId,
        ),
      ]);

      if (
        !isPinEligibleAccount(account, actorAccountId) ||
        !isActorBoundCredential(credential, actorAccountId) ||
        isConfiguredPinCredential(credential)
      ) {
        return genericPinSetupFailure;
      }

      await repositories.accountPinCredentials.updatePinCredential(
        createSuccessfulCredential(credential, derivedPinCredential),
      );
      await repositories.auditLogs.append(setupAudit);

      return Object.freeze({
        status: "setup",
        accountId: account.id,
      });
    });
  }

  public async changePin(input: unknown): Promise<PinChangeResult> {
    const parsedCommand = pinChangeCommandSchema.safeParse(input);

    if (!parsedCommand.success) {
      return genericPinChangeFailure;
    }

    const { actorAccountId } = parsedCommand.data;
    const [currentPinCredential, newPinCredential] = await Promise.all([
      derivePrototypePinCredential(parsedCommand.data.currentPin),
      derivePrototypePinCredential(parsedCommand.data.newPin),
    ]);
    const operationTime = getPinOperationTime(this.dependencies.clock);
    const auditLogId = this.dependencies.idProvider.generateId("audit-log");
    const failedAudit = createFailedVerificationAudit(
      auditLogId,
      actorAccountId,
      operationTime.occurredAt,
    );
    const setupAudit = createPinSetupAudit(
      auditLogId,
      actorAccountId,
      operationTime.occurredAt,
      "change",
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const context = await loadPinContext(
        repositories,
        actorAccountId,
        currentPinCredential,
      );

      if (
        !isPinEligibleAccount(context.account, actorAccountId) ||
        !isActorBoundCredential(context.credential, actorAccountId)
      ) {
        return genericPinChangeFailure;
      }

      if (!isConfiguredPinCredential(context.credential)) {
        return genericPinChangeFailure;
      }

      if (isActiveLock(context.credential, operationTime.epochMilliseconds)) {
        return createLockedResult(context.credential.lockedUntil);
      }

      if (!context.credentialMatches) {
        const lockedResult = await recordFailedVerification(
          repositories,
          context.credential,
          failedAudit,
          operationTime,
        );

        return lockedResult ?? genericPinChangeFailure;
      }

      await repositories.accountPinCredentials.updatePinCredential(
        createSuccessfulCredential(context.credential, newPinCredential),
      );
      await repositories.auditLogs.append(setupAudit);

      return Object.freeze({
        status: "changed",
        accountId: context.account.id,
      });
    });
  }
}
