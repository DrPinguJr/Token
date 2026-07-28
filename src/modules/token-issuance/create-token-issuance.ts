import type { AccountRepository } from "@/modules/accounts";
import {
  prepareAuditLog,
  type AuditLog,
  type AuditLogRepository,
} from "@/modules/audit-logs";
import type { CustomerRepository } from "@/modules/customers";
import type { EventSettingsRepository } from "@/modules/event-settings";
import {
  evidenceSchema,
  type Evidence,
  type EvidenceRepository,
} from "@/modules/evidence";
import {
  assertIdempotencyKeyAvailable,
  assertNonNegativeWalletBalance,
  assertPositiveTokenAmount,
  assertTransactionGroupIdAvailable,
  assertTransactionActor,
  calculateProjectedWalletBalance,
  createOperationLedgerIdempotencyKey,
  DuplicateIdempotencyKeyError,
  ledgerEntrySchema,
  type LedgerEntry,
  type LedgerEntryRepository,
  type RepositoryTransactionRunner,
  type TransactionClock,
  type TransactionGroupIdProvider,
  type TransactionIdProvider,
  type TransactionReferenceProvider,
} from "@/modules/transactions";
import {
  calculateWalletBalance,
  type WalletRepository,
} from "@/modules/wallets";

import { calculateIssuedTokenAmount } from "./calculate-issued-token-amount";
import {
  createTokenIssuanceCommandSchema,
  type CreateTokenIssuanceCommand,
} from "./create-token-issuance-schema";
import { normalizePaymentReference } from "./normalize-payment-reference";
import {
  DuplicatePaymentReferenceAcknowledgementRequiredError,
  TokenIssuanceCommandValidationError,
  TokenIssuanceError,
  TokenIssuanceEvidenceValidationError,
} from "./token-issuance-errors";
import type { TokenIssuance } from "./token-issuance";
import type { TokenIssuanceRepository } from "./token-issuance-repository";
import { tokenIssuanceSchema } from "./token-issuance-schema";

export interface TokenIssuanceTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getById">;
  readonly eventSettings: Pick<EventSettingsRepository, "get">;
  readonly evidence: Pick<EvidenceRepository, "create">;
  readonly ledgerEntries: Pick<
    LedgerEntryRepository,
    | "append"
    | "findByWalletId"
    | "getByIdempotencyKey"
    | "findByTransactionGroupId"
  >;
  readonly tokenIssuances: Pick<
    TokenIssuanceRepository,
    "create" | "findByNormalizedPaymentReference" | "getByIdempotencyKey"
  >;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export interface TokenIssuanceServiceDependencies {
  readonly transactionRunner: RepositoryTransactionRunner<TokenIssuanceTransactionRepositories>;
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly transactionGroupIdProvider: TransactionGroupIdProvider;
  readonly referenceProvider: TransactionReferenceProvider;
}

export interface TokenIssuanceReceipt {
  readonly issuance: TokenIssuance;
  readonly evidence: Evidence;
  readonly ledgerEntry: LedgerEntry;
  readonly auditLogs: readonly AuditLog[];
  readonly previousBalance: number;
  readonly resultingBalance: number;
  readonly duplicatePaymentReferenceAcknowledged: boolean;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length === 0 ? "command" : path.map(String).join(".");
}

function parseCommand(command: unknown): CreateTokenIssuanceCommand {
  const result = createTokenIssuanceCommandSchema.safeParse(command);

  if (result.success) {
    return result.data;
  }

  const issuePaths = result.error.issues.map(({ path }) =>
    formatIssuePath(path),
  );

  if (result.error.issues.some(({ path }) => path[0] === "evidence")) {
    throw new TokenIssuanceEvidenceValidationError(issuePaths);
  }

  throw new TokenIssuanceCommandValidationError(issuePaths);
}

function throwIssuanceError(
  code: ConstructorParameters<typeof TokenIssuanceError>[0],
  message: string,
): never {
  throw new TokenIssuanceError(code, message);
}

/**
 * Creates a manual staff issuance and every linked record in one repository
 * unit of work. The service never treats local evidence as payment verification.
 */
export class TokenIssuanceService {
  public constructor(
    private readonly dependencies: TokenIssuanceServiceDependencies,
  ) {}

  public async issue(command: unknown): Promise<TokenIssuanceReceipt> {
    const parsedCommand = parseCommand(command);
    const operationLedgerIdempotencyKey = createOperationLedgerIdempotencyKey(
      parsedCommand.idempotencyKey,
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      assertTransactionActor(parsedCommand.actorAccountId);
      await assertIdempotencyKeyAvailable(
        repositories.ledgerEntries,
        operationLedgerIdempotencyKey,
      );

      if (
        (await repositories.tokenIssuances.getByIdempotencyKey(
          parsedCommand.idempotencyKey,
        )) !== null
      ) {
        throw new DuplicateIdempotencyKeyError(parsedCommand.idempotencyKey);
      }

      const [staffAccount, customer, settings] = await Promise.all([
        repositories.accounts.getById(parsedCommand.actorAccountId),
        repositories.customers.getById(parsedCommand.customerId),
        repositories.eventSettings.get(),
      ]);

      if (staffAccount === null) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_STAFF_ACCOUNT_NOT_FOUND",
          "The staff account does not exist.",
        );
      }
      if (staffAccount.status !== "active") {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_STAFF_ACCOUNT_INACTIVE",
          "The staff account is not active.",
        );
      }
      if (staffAccount.role !== "staff") {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_STAFF_ROLE_REQUIRED",
          "Only an active staff account can issue tokens.",
        );
      }
      if (customer === null) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_CUSTOMER_NOT_FOUND",
          "The customer does not exist.",
        );
      }
      if (settings === null) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_EVENT_SETTINGS_NOT_FOUND",
          "Event settings are unavailable.",
        );
      }

      const [customerAccount, wallet, existingEntries] = await Promise.all([
        repositories.accounts.getById(customer.accountId),
        repositories.wallets.getById(customer.walletId),
        repositories.ledgerEntries.findByWalletId(customer.walletId),
      ]);

      if (customerAccount === null) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_NOT_FOUND",
          "The customer account does not exist.",
        );
      }
      if (
        customerAccount.role !== "customer" ||
        customerAccount.id !== customer.accountId
      ) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_MISMATCH",
          "The customer profile does not match a customer account.",
        );
      }
      if (customerAccount.status !== "active") {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_INACTIVE",
          "The customer account is not active.",
        );
      }
      if (wallet === null) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_WALLET_NOT_FOUND",
          "The customer wallet does not exist.",
        );
      }
      if (
        wallet.ownerAccountId !== customer.accountId ||
        wallet.ownerType !== "customer" ||
        wallet.id !== customer.walletId
      ) {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_WALLET_OWNERSHIP_MISMATCH",
          "The wallet does not belong to the selected customer.",
        );
      }
      if (wallet.status !== "active") {
        return throwIssuanceError(
          "TOKEN_ISSUANCE_WALLET_INACTIVE",
          "The customer wallet is not active.",
        );
      }

      const previousBalance = calculateWalletBalance(existingEntries);
      assertNonNegativeWalletBalance(previousBalance);

      const paymentReference =
        parsedCommand.paymentReference === undefined
          ? null
          : parsedCommand.paymentReference;
      const normalizedPaymentReference =
        paymentReference === null
          ? null
          : normalizePaymentReference(paymentReference);
      const matchingIssuances =
        normalizedPaymentReference === null
          ? []
          : await repositories.tokenIssuances.findByNormalizedPaymentReference(
              normalizedPaymentReference,
            );
      const duplicateReferenceAcknowledged =
        matchingIssuances.length > 0 &&
        parsedCommand.duplicatePaymentReferenceAcknowledged;

      if (
        matchingIssuances.length > 0 &&
        !parsedCommand.duplicatePaymentReferenceAcknowledged
      ) {
        throw new DuplicatePaymentReferenceAcknowledgementRequiredError(
          matchingIssuances.length,
        );
      }

      const tokenAmount = calculateIssuedTokenAmount(
        parsedCommand.paynowAmountCents,
        settings.tokensPerDollar,
      );
      assertPositiveTokenAmount(tokenAmount);

      const occurredAt = this.dependencies.clock.now();
      const transactionGroupId =
        this.dependencies.transactionGroupIdProvider.generateTransactionGroupId();
      await assertTransactionGroupIdAvailable(
        repositories.ledgerEntries,
        transactionGroupId,
      );
      const evidenceId = this.dependencies.idProvider.generateId("evidence");
      const issuanceId =
        this.dependencies.idProvider.generateId("token-issuance");
      const ledgerEntryId =
        this.dependencies.idProvider.generateId("ledger-entry");
      const reference =
        this.dependencies.referenceProvider.generateReference("issuance");

      const evidence = evidenceSchema.parse({
        id: evidenceId,
        kind: "paynow_screenshot",
        fileName: parsedCommand.evidence.fileName,
        mimeType: parsedCommand.evidence.mimeType,
        sizeBytes: parsedCommand.evidence.sizeBytes,
        localBlobKey:
          this.dependencies.idProvider.generateId("evidence-content"),
        capturedByAccountId: staffAccount.id,
        createdAt: occurredAt,
        metadata: parsedCommand.evidence.metadata,
      });
      const issuance = tokenIssuanceSchema.parse({
        id: issuanceId,
        customerId: customer.id,
        walletId: wallet.id,
        staffAccountId: staffAccount.id,
        evidenceId: evidence.id,
        paynowAmountCents: parsedCommand.paynowAmountCents,
        tokensPerDollar: settings.tokensPerDollar,
        tokenAmount,
        paymentReference,
        normalizedPaymentReference,
        note: parsedCommand.note ?? null,
        transactionGroupId,
        reference,
        idempotencyKey: parsedCommand.idempotencyKey,
        createdAt: occurredAt,
      });
      const ledgerEntry = ledgerEntrySchema.parse({
        id: ledgerEntryId,
        walletId: wallet.id,
        transactionGroupId,
        entryType: "token_issuance",
        direction: "credit",
        tokenAmount,
        actorAccountId: staffAccount.id,
        relatedCustomerId: customer.id,
        relatedVendorId: null,
        relatedOrderId: null,
        relatedEvidenceId: evidence.id,
        reference,
        description: "Manual token issuance recorded by event staff.",
        occurredAt,
        idempotencyKey: operationLedgerIdempotencyKey,
        metadata: {
          paynowAmountCents: parsedCommand.paynowAmountCents,
          tokensPerDollar: settings.tokensPerDollar,
          source: "staff_manual_issuance",
        },
        reversesLedgerEntryId: null,
      });
      const resultingBalance = calculateProjectedWalletBalance(
        previousBalance,
        "credit",
        tokenAmount,
      );

      const evidenceAudit = prepareAuditLog(
        {
          eventType: "evidence_attached",
          actorAccountId: staffAccount.id,
          targetType: "evidence",
          targetId: evidence.id,
          description:
            "Local prototype payment evidence attached by event staff.",
          metadata: {
            captureMode: evidence.metadata.captureMode,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            source: "staff_manual_issuance",
          },
          transactionGroupId,
        },
        {
          id: this.dependencies.idProvider.generateId("audit-log"),
          occurredAt,
        },
      );
      const issuanceAudit = prepareAuditLog(
        {
          eventType: "token_issuance_created",
          actorAccountId: staffAccount.id,
          targetType: "token_issuance",
          targetId: issuance.id,
          description:
            "Token issuance recorded after a manual staff payment check.",
          metadata: {
            duplicatePaymentReferenceAcknowledged:
              duplicateReferenceAcknowledged,
            matchingPaymentReferenceCount: matchingIssuances.length,
            paynowAmountCents: issuance.paynowAmountCents,
            tokenAmount: issuance.tokenAmount,
            tokensPerDollar: issuance.tokensPerDollar,
            source: "staff_manual_issuance",
          },
          transactionGroupId,
        },
        {
          id: this.dependencies.idProvider.generateId("audit-log"),
          occurredAt,
        },
      );
      const auditLogs = [evidenceAudit, issuanceAudit] as const;

      await repositories.evidence.create(
        evidence,
        parsedCommand.evidence.content,
      );
      await repositories.tokenIssuances.create(issuance);
      await repositories.ledgerEntries.append(ledgerEntry);
      for (const auditLog of auditLogs) {
        await repositories.auditLogs.append(auditLog);
      }

      return Object.freeze({
        issuance,
        evidence,
        ledgerEntry,
        auditLogs,
        previousBalance,
        resultingBalance,
        duplicatePaymentReferenceAcknowledged: duplicateReferenceAcknowledged,
      });
    });
  }
}
