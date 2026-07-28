import type { z } from "zod";

import type { AccountRepository } from "@/modules/accounts";
import {
  prepareAuditLog,
  type AuditLog,
  type AuditLogRepository,
} from "@/modules/audit-logs";
import type { CustomerRepository } from "@/modules/customers";
import {
  assertNonNegativeWalletBalance,
  assertTransactionGroupIdAvailable,
  calculateProjectedWalletBalance,
  createOperationLedgerIdempotencyKey,
  DuplicateTransactionGroupIdError,
  InsufficientWalletBalanceError,
  ledgerEntrySchema,
  type LedgerEntry,
  type LedgerEntryRepository,
  type RepositoryTransactionRunner,
  type TransactionClock,
  type TransactionGroupIdProvider,
  type TransactionIdProvider,
  type TransactionReferenceProvider,
} from "@/modules/transactions";
import type { VendorRepository } from "@/modules/vendors";

import { administrativeAdjustmentCommandSchema } from "./administrative-adjustment-command-schema";
import { AdministrativeAdjustmentServiceError } from "./administrative-adjustment-service-error";
import { calculateWalletBalance } from "./calculate-wallet-balance";
import type { WalletRepository } from "./wallet-repository";

export type AdministrativeAdjustmentCommand = Readonly<
  z.infer<typeof administrativeAdjustmentCommandSchema>
>;

export interface AdministrativeAdjustmentTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
  readonly ledgerEntries: Pick<
    LedgerEntryRepository,
    | "append"
    | "findByTransactionGroupId"
    | "findByWalletId"
    | "getByIdempotencyKey"
  >;
  readonly vendors: Pick<VendorRepository, "getByAccountId">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export type AdministrativeAdjustmentTransactionRunner =
  RepositoryTransactionRunner<AdministrativeAdjustmentTransactionRepositories>;

export interface AdministrativeAdjustmentServiceDependencies {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly referenceProvider: TransactionReferenceProvider;
  readonly transactionGroupIdProvider: TransactionGroupIdProvider;
  readonly transactionRunner: AdministrativeAdjustmentTransactionRunner;
}

export interface AdministrativeAdjustmentReceipt {
  readonly ledgerEntry: LedgerEntry;
  readonly auditLog: AuditLog;
  readonly previousBalance: number;
  readonly resultingBalance: number;
}

function parseAdministrativeAdjustmentCommand(
  command: unknown,
): AdministrativeAdjustmentCommand {
  const result = administrativeAdjustmentCommandSchema.safeParse(command);

  if (!result.success) {
    throw new AdministrativeAdjustmentServiceError(
      "ADJUSTMENT_INVALID_COMMAND",
    );
  }

  return Object.freeze(result.data);
}

/**
 * Appends an explicit administrator correction and its audit record in one
 * transaction. It never stores or assigns a wallet balance.
 */
export class AdministrativeAdjustmentService {
  public constructor(
    private readonly dependencies: AdministrativeAdjustmentServiceDependencies,
  ) {}

  public async createAdjustment(
    command: unknown,
  ): Promise<AdministrativeAdjustmentReceipt> {
    const parsedCommand = parseAdministrativeAdjustmentCommand(command);
    const occurredAt = this.dependencies.clock.now();
    const transactionGroupId =
      this.dependencies.transactionGroupIdProvider.generateTransactionGroupId();
    const reference =
      this.dependencies.referenceProvider.generateReference("adjustment");
    const ledgerEntryId =
      this.dependencies.idProvider.generateId("ledger-entry");
    const auditLogId = this.dependencies.idProvider.generateId("audit-log");
    const ledgerIdempotencyKey = createOperationLedgerIdempotencyKey(
      parsedCommand.idempotencyKey,
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const [actor, wallet, existingEntry, walletEntries] = await Promise.all([
        repositories.accounts.getById(parsedCommand.actorAccountId),
        repositories.wallets.getById(parsedCommand.walletId),
        repositories.ledgerEntries.getByIdempotencyKey(ledgerIdempotencyKey),
        repositories.ledgerEntries.findByWalletId(parsedCommand.walletId),
      ]);

      if (
        actor === null ||
        actor.role !== "administrator" ||
        actor.status !== "active"
      ) {
        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_ACTOR_NOT_ACTIVE_ADMINISTRATOR",
        );
      }

      if (wallet === null) {
        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_WALLET_NOT_FOUND",
        );
      }

      if (wallet.status !== "active") {
        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_WALLET_NOT_ACTIVE",
        );
      }

      if (existingEntry !== null) {
        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_DUPLICATE_IDEMPOTENCY_KEY",
        );
      }

      const ownerAccount = await repositories.accounts.getById(
        wallet.ownerAccountId,
      );
      let relatedCustomerId: string | null = null;
      let relatedVendorId: string | null = null;

      if (wallet.ownerType === "customer") {
        const customer = await repositories.customers.getByAccountId(
          wallet.ownerAccountId,
        );

        if (
          ownerAccount === null ||
          ownerAccount.role !== "customer" ||
          customer === null ||
          customer.accountId !== ownerAccount.id ||
          customer.walletId !== wallet.id
        ) {
          throw new AdministrativeAdjustmentServiceError(
            "ADJUSTMENT_WALLET_OWNER_INVALID",
          );
        }

        relatedCustomerId = customer.id;
      } else {
        const vendor = await repositories.vendors.getByAccountId(
          wallet.ownerAccountId,
        );

        if (
          ownerAccount === null ||
          ownerAccount.role !== "vendor" ||
          vendor === null ||
          vendor.accountId !== ownerAccount.id ||
          vendor.walletId !== wallet.id
        ) {
          throw new AdministrativeAdjustmentServiceError(
            "ADJUSTMENT_WALLET_OWNER_INVALID",
          );
        }

        relatedVendorId = vendor.id;
      }

      try {
        await assertTransactionGroupIdAvailable(
          repositories.ledgerEntries,
          transactionGroupId,
        );
      } catch (error: unknown) {
        if (error instanceof DuplicateTransactionGroupIdError) {
          throw new AdministrativeAdjustmentServiceError(
            "ADJUSTMENT_TRANSACTION_GROUP_COLLISION",
          );
        }

        throw error;
      }

      let previousBalance: number;

      try {
        previousBalance = calculateWalletBalance(walletEntries);
        assertNonNegativeWalletBalance(previousBalance);
      } catch {
        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_CURRENT_BALANCE_INVALID",
        );
      }

      let resultingBalance: number;

      try {
        resultingBalance = calculateProjectedWalletBalance(
          previousBalance,
          parsedCommand.direction,
          parsedCommand.tokenAmount,
        );
      } catch (error: unknown) {
        if (error instanceof InsufficientWalletBalanceError) {
          throw new AdministrativeAdjustmentServiceError(
            "ADJUSTMENT_WALLET_BALANCE_INSUFFICIENT",
          );
        }

        throw new AdministrativeAdjustmentServiceError(
          "ADJUSTMENT_RESULTING_BALANCE_UNSAFE",
        );
      }

      const ledgerEntry = Object.freeze(
        ledgerEntrySchema.parse({
          id: ledgerEntryId,
          walletId: wallet.id,
          transactionGroupId,
          entryType: "administrative_adjustment",
          direction: parsedCommand.direction,
          tokenAmount: parsedCommand.tokenAmount,
          actorAccountId: actor.id,
          relatedCustomerId,
          relatedVendorId,
          relatedOrderId: null,
          relatedEvidenceId: null,
          reference,
          description: `Administrative ${parsedCommand.direction} adjustment: ${parsedCommand.reason}`,
          occurredAt,
          idempotencyKey: ledgerIdempotencyKey,
          metadata: {
            reason: parsedCommand.reason,
            source: "administrative_adjustment_service",
            walletOwnerAccountId: wallet.ownerAccountId,
            walletOwnerType: wallet.ownerType,
          },
          reversesLedgerEntryId: null,
        }),
      );
      const auditLog = prepareAuditLog(
        {
          eventType: "administrative_adjustment_created",
          actorAccountId: actor.id,
          targetType: "ledger_entry",
          targetId: ledgerEntry.id,
          description: `Administrative ${parsedCommand.direction} adjustment recorded.`,
          metadata: {
            walletId: wallet.id,
            direction: parsedCommand.direction,
            tokenAmount: parsedCommand.tokenAmount,
            reason: parsedCommand.reason,
            previousBalance,
            resultingBalance,
          },
          transactionGroupId,
        },
        {
          id: auditLogId,
          occurredAt,
        },
      );

      await repositories.ledgerEntries.append(ledgerEntry);
      await repositories.auditLogs.append(auditLog);

      return Object.freeze({
        ledgerEntry,
        auditLog,
        previousBalance,
        resultingBalance,
      });
    });
  }
}
