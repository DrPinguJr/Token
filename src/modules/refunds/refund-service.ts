import type { z } from "zod";

import type { AccountRepository } from "@/modules/accounts";
import {
  prepareAuditLog,
  type AuditLog,
  type AuditLogRepository,
} from "@/modules/audit-logs";
import type { CustomerRepository } from "@/modules/customers";
import type { Order, OrderRepository } from "@/modules/orders";
import {
  assertNonNegativeWalletBalance,
  assertTransactionGroupIdAvailable,
  calculateProjectedWalletBalance,
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
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
import {
  calculateWalletBalance,
  type WalletRepository,
} from "@/modules/wallets";

import { refundCommandSchema } from "./refund-command-schema";
import type { Refund } from "./refund";
import type { RefundRepository } from "./refund-repository";
import { refundSchema } from "./refund-schema";
import { RefundServiceError } from "./refund-service-error";

export type RefundCommand = Readonly<z.infer<typeof refundCommandSchema>>;

export type RefundAuthorizationHook = (command: RefundCommand) => Promise<void>;

export interface RefundTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getById">;
  readonly ledgerEntries: Pick<
    LedgerEntryRepository,
    | "append"
    | "findByRelatedOrderId"
    | "findByTransactionGroupId"
    | "findByWalletId"
    | "getByIdempotencyKey"
  >;
  readonly orders: Pick<OrderRepository, "getById">;
  readonly refunds: Pick<
    RefundRepository,
    "create" | "findByOrderId" | "getByIdempotencyKey"
  >;
  readonly vendors: Pick<VendorRepository, "getByAccountId">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export type RefundTransactionRunner =
  RepositoryTransactionRunner<RefundTransactionRepositories>;

export interface RefundServiceDependencies {
  readonly authorize: RefundAuthorizationHook;
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly referenceProvider: TransactionReferenceProvider;
  readonly transactionGroupIdProvider: TransactionGroupIdProvider;
  readonly transactionRunner: RefundTransactionRunner;
}

export interface RefundReceipt {
  readonly refund: Refund;
  readonly customerLedgerEntry: LedgerEntry;
  readonly vendorLedgerEntry: LedgerEntry;
  readonly auditLog: AuditLog;
  readonly remainingRefundableTokenAmount: number;
}

interface OriginalOrderLedgerPair {
  readonly customerDebit: LedgerEntry;
  readonly vendorCredit: LedgerEntry;
}

function isSupportedLedgerSource(
  source: unknown,
  serviceSource: "purchase_service" | "refund_service",
): boolean {
  return source === serviceSource || source === "deterministic_seed";
}

function loadOriginalOrderLedgerPair(
  order: Order,
  transactionGroupEntries: readonly LedgerEntry[],
  customerAccountId: string,
): OriginalOrderLedgerPair {
  const customerDebitIdempotencyKey = createOperationLedgerIdempotencyKey(
    order.idempotencyKey,
  );
  const vendorCreditIdempotencyKey = createScopedLedgerIdempotencyKey(
    order.idempotencyKey,
    "vendor-credit",
  );
  const customerDebits = transactionGroupEntries.filter(
    (entry) =>
      entry.transactionGroupId === order.transactionGroupId &&
      entry.walletId === order.customerWalletId &&
      entry.entryType === "customer_purchase" &&
      entry.direction === "debit" &&
      entry.tokenAmount === order.tokenTotal &&
      entry.relatedCustomerId === order.customerId &&
      entry.relatedVendorId === order.vendorId &&
      entry.relatedOrderId === order.id &&
      entry.actorAccountId === customerAccountId &&
      entry.reference === order.reference &&
      entry.occurredAt === order.completedAt &&
      entry.idempotencyKey === customerDebitIdempotencyKey &&
      entry.reversesLedgerEntryId === null,
  );
  const vendorCredits = transactionGroupEntries.filter(
    (entry) =>
      entry.transactionGroupId === order.transactionGroupId &&
      entry.walletId === order.vendorWalletId &&
      entry.entryType === "vendor_receipt" &&
      entry.direction === "credit" &&
      entry.tokenAmount === order.tokenTotal &&
      entry.relatedCustomerId === order.customerId &&
      entry.relatedVendorId === order.vendorId &&
      entry.relatedOrderId === order.id &&
      entry.actorAccountId === customerAccountId &&
      entry.reference === order.reference &&
      entry.occurredAt === order.completedAt &&
      entry.idempotencyKey === vendorCreditIdempotencyKey &&
      entry.reversesLedgerEntryId === null,
  );

  const customerDebit = customerDebits[0];
  const vendorCredit = vendorCredits[0];

  if (
    customerDebits.length !== 1 ||
    vendorCredits.length !== 1 ||
    transactionGroupEntries.length !== 2 ||
    customerDebit === undefined ||
    vendorCredit === undefined ||
    customerDebit.id === vendorCredit.id ||
    customerDebit.metadata.pairedLedgerEntryId !== vendorCredit.id ||
    vendorCredit.metadata.pairedLedgerEntryId !== customerDebit.id ||
    !isSupportedLedgerSource(
      customerDebit.metadata.source,
      "purchase_service",
    ) ||
    !isSupportedLedgerSource(vendorCredit.metadata.source, "purchase_service")
  ) {
    throw new RefundServiceError("REFUND_ORIGINAL_LEDGER_PAIR_INVALID");
  }

  return { customerDebit, vendorCredit };
}

interface PriorRefundLedgerGroup {
  readonly refund: Refund;
  readonly entries: readonly LedgerEntry[];
}

function matchesPriorRefundEntry(
  entry: LedgerEntry,
  refund: Refund,
  order: Order,
  expected: {
    readonly direction: "credit" | "debit";
    readonly entryType: "customer_refund" | "vendor_refund";
    readonly idempotencyKey: string;
    readonly reversesLedgerEntryId: string;
    readonly walletId: string;
  },
): boolean {
  return (
    entry.walletId === expected.walletId &&
    entry.transactionGroupId === refund.transactionGroupId &&
    entry.entryType === expected.entryType &&
    entry.direction === expected.direction &&
    entry.tokenAmount === refund.tokenAmount &&
    entry.actorAccountId === refund.actorAccountId &&
    entry.relatedCustomerId === order.customerId &&
    entry.relatedVendorId === order.vendorId &&
    entry.relatedOrderId === order.id &&
    entry.relatedEvidenceId === null &&
    entry.reference === refund.reference &&
    entry.occurredAt === refund.createdAt &&
    entry.idempotencyKey === expected.idempotencyKey &&
    entry.reversesLedgerEntryId === expected.reversesLedgerEntryId &&
    entry.metadata.refundId === refund.id &&
    entry.metadata.reason === refund.reason &&
    isSupportedLedgerSource(entry.metadata.source, "refund_service")
  );
}

function calculateRemainingRefundableAmount(
  order: Order,
  originalPair: OriginalOrderLedgerPair,
  priorRefundGroups: readonly PriorRefundLedgerGroup[],
  orderEntries: readonly LedgerEntry[],
): number {
  const reconciledLedgerEntryIds = new Set<string>();
  const seenRefundIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();
  const seenTransactionGroupIds = new Set<string>();
  let priorRefundTokenAmount = BigInt(0);
  const orderTokenTotal = BigInt(order.tokenTotal);

  for (const { refund: priorRefund, entries } of priorRefundGroups) {
    if (
      priorRefund.orderId !== order.id ||
      priorRefund.customerId !== order.customerId ||
      priorRefund.vendorId !== order.vendorId ||
      seenRefundIds.has(priorRefund.id) ||
      seenIdempotencyKeys.has(priorRefund.idempotencyKey) ||
      seenTransactionGroupIds.has(priorRefund.transactionGroupId)
    ) {
      throw new RefundServiceError("REFUND_PRIOR_RECORDS_INVALID");
    }

    seenRefundIds.add(priorRefund.id);
    seenIdempotencyKeys.add(priorRefund.idempotencyKey);
    seenTransactionGroupIds.add(priorRefund.transactionGroupId);

    const customerCreditIdempotencyKey = createOperationLedgerIdempotencyKey(
      priorRefund.idempotencyKey,
    );
    const vendorDebitIdempotencyKey = createScopedLedgerIdempotencyKey(
      priorRefund.idempotencyKey,
      "vendor-debit",
    );
    const customerCredits = entries.filter((entry) =>
      matchesPriorRefundEntry(entry, priorRefund, order, {
        direction: "credit",
        entryType: "customer_refund",
        idempotencyKey: customerCreditIdempotencyKey,
        reversesLedgerEntryId: originalPair.customerDebit.id,
        walletId: order.customerWalletId,
      }),
    );
    const vendorDebits = entries.filter((entry) =>
      matchesPriorRefundEntry(entry, priorRefund, order, {
        direction: "debit",
        entryType: "vendor_refund",
        idempotencyKey: vendorDebitIdempotencyKey,
        reversesLedgerEntryId: originalPair.vendorCredit.id,
        walletId: order.vendorWalletId,
      }),
    );
    const customerCredit = customerCredits[0];
    const vendorDebit = vendorDebits[0];

    if (
      entries.length !== 2 ||
      customerCredits.length !== 1 ||
      vendorDebits.length !== 1 ||
      customerCredit === undefined ||
      vendorDebit === undefined ||
      customerCredit.id === vendorDebit.id ||
      customerCredit.metadata.pairedLedgerEntryId !== vendorDebit.id ||
      vendorDebit.metadata.pairedLedgerEntryId !== customerCredit.id
    ) {
      throw new RefundServiceError("REFUND_PRIOR_RECORDS_INVALID");
    }

    reconciledLedgerEntryIds.add(customerCredit.id);
    reconciledLedgerEntryIds.add(vendorDebit.id);
    priorRefundTokenAmount += BigInt(priorRefund.tokenAmount);

    if (priorRefundTokenAmount > orderTokenTotal) {
      throw new RefundServiceError("REFUND_PRIOR_RECORDS_INVALID");
    }
  }

  const hasOrphanRefundEntry = orderEntries.some(
    (entry) =>
      (entry.entryType === "customer_refund" ||
        entry.entryType === "vendor_refund") &&
      !reconciledLedgerEntryIds.has(entry.id),
  );

  if (hasOrphanRefundEntry) {
    throw new RefundServiceError("REFUND_PRIOR_RECORDS_INVALID");
  }

  return Number(orderTokenTotal - priorRefundTokenAmount);
}

function calculateNonNegativeRefundWalletBalance(
  entries: readonly LedgerEntry[],
  errorCode:
    "REFUND_CUSTOMER_BALANCE_INVALID" | "REFUND_VENDOR_BALANCE_INVALID",
): number {
  try {
    const balance = calculateWalletBalance(entries);
    assertNonNegativeWalletBalance(balance);
    return balance;
  } catch {
    throw new RefundServiceError(errorCode);
  }
}

function parseRefundCommand(command: unknown): RefundCommand {
  const result = refundCommandSchema.safeParse(command);

  if (!result.success) {
    throw new RefundServiceError("REFUND_INVALID_COMMAND");
  }

  return Object.freeze(result.data);
}

/**
 * Creates a full or partial refund without modifying the completed order or its
 * original purchase entries. Authorization (the Phase 4 PIN hook) is invoked
 * before the transaction runner opens its persistence unit of work.
 */
export class RefundService {
  public constructor(
    private readonly dependencies: RefundServiceDependencies,
  ) {}

  public async createRefund(command: unknown): Promise<RefundReceipt> {
    const parsedCommand = parseRefundCommand(command);
    await this.dependencies.authorize(parsedCommand);

    const occurredAt = this.dependencies.clock.now();
    const transactionGroupId =
      this.dependencies.transactionGroupIdProvider.generateTransactionGroupId();
    const reference =
      this.dependencies.referenceProvider.generateReference("refund");
    const refundId = this.dependencies.idProvider.generateId("refund");
    const customerLedgerEntryId =
      this.dependencies.idProvider.generateId("ledger-entry");
    const vendorLedgerEntryId =
      this.dependencies.idProvider.generateId("ledger-entry");
    const auditLogId = this.dependencies.idProvider.generateId("audit-log");
    const customerCreditIdempotencyKey = createOperationLedgerIdempotencyKey(
      parsedCommand.idempotencyKey,
    );
    const vendorDebitIdempotencyKey = createScopedLedgerIdempotencyKey(
      parsedCommand.idempotencyKey,
      "vendor-debit",
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const [
        actor,
        order,
        duplicateRefund,
        duplicateCustomerEntry,
        duplicateVendorEntry,
      ] = await Promise.all([
        repositories.accounts.getById(parsedCommand.actorAccountId),
        repositories.orders.getById(parsedCommand.orderId),
        repositories.refunds.getByIdempotencyKey(parsedCommand.idempotencyKey),
        repositories.ledgerEntries.getByIdempotencyKey(
          customerCreditIdempotencyKey,
        ),
        repositories.ledgerEntries.getByIdempotencyKey(
          vendorDebitIdempotencyKey,
        ),
      ]);

      if (
        actor === null ||
        actor.role !== "vendor" ||
        actor.status !== "active"
      ) {
        throw new RefundServiceError("REFUND_ACTOR_NOT_ACTIVE_VENDOR");
      }

      if (duplicateRefund !== null) {
        throw new RefundServiceError("REFUND_DUPLICATE_IDEMPOTENCY_KEY");
      }

      if (order === null) {
        throw new RefundServiceError("REFUND_ORDER_NOT_FOUND");
      }

      if (order.status !== "completed") {
        throw new RefundServiceError("REFUND_ORDER_NOT_COMPLETED");
      }

      const vendor = await repositories.vendors.getByAccountId(actor.id);

      if (vendor === null) {
        throw new RefundServiceError("REFUND_VENDOR_NOT_FOUND");
      }

      if (vendor.id !== order.vendorId) {
        throw new RefundServiceError("REFUND_ORDER_OWNERSHIP_MISMATCH");
      }

      const [
        customerWallet,
        vendorWallet,
        customer,
        priorRefunds,
        orderEntries,
        originalTransactionGroupEntries,
        customerWalletEntries,
        vendorWalletEntries,
      ] = await Promise.all([
        repositories.wallets.getById(order.customerWalletId),
        repositories.wallets.getById(order.vendorWalletId),
        repositories.customers.getById(order.customerId),
        repositories.refunds.findByOrderId(order.id),
        repositories.ledgerEntries.findByRelatedOrderId(order.id),
        repositories.ledgerEntries.findByTransactionGroupId(
          order.transactionGroupId,
        ),
        repositories.ledgerEntries.findByWalletId(order.customerWalletId),
        repositories.ledgerEntries.findByWalletId(order.vendorWalletId),
      ]);

      if (customerWallet === null || vendorWallet === null) {
        throw new RefundServiceError("REFUND_WALLET_NOT_ACTIVE");
      }

      if (
        customer === null ||
        customer.walletId !== order.customerWalletId ||
        customerWallet.ownerAccountId !== customer.accountId ||
        customerWallet.ownerType !== "customer" ||
        vendor.walletId !== order.vendorWalletId ||
        vendorWallet.ownerAccountId !== vendor.accountId ||
        vendorWallet.ownerType !== "vendor"
      ) {
        throw new RefundServiceError("REFUND_ORDER_RELATIONSHIPS_INVALID");
      }

      const customerAccount = await repositories.accounts.getById(
        customer.accountId,
      );

      // A disabled customer login may still receive an owed refund. The account
      // must nevertheless exist, have the customer role, and own the exact
      // profile/wallet relationship.
      if (
        customerAccount === null ||
        customerAccount.role !== "customer" ||
        customerAccount.id !== customer.accountId
      ) {
        throw new RefundServiceError("REFUND_CUSTOMER_ACCOUNT_INVALID");
      }

      if (
        customerWallet.status !== "active" ||
        vendorWallet.status !== "active"
      ) {
        throw new RefundServiceError("REFUND_WALLET_NOT_ACTIVE");
      }

      if (duplicateCustomerEntry !== null || duplicateVendorEntry !== null) {
        throw new RefundServiceError("REFUND_DUPLICATE_IDEMPOTENCY_KEY");
      }

      try {
        await assertTransactionGroupIdAvailable(
          repositories.ledgerEntries,
          transactionGroupId,
        );
      } catch (error: unknown) {
        if (error instanceof DuplicateTransactionGroupIdError) {
          throw new RefundServiceError("REFUND_TRANSACTION_GROUP_COLLISION");
        }

        throw error;
      }

      const originalPair = loadOriginalOrderLedgerPair(
        order,
        originalTransactionGroupEntries,
        customerAccount.id,
      );
      const priorRefundLedgerGroups = await Promise.all(
        priorRefunds.map(async (priorRefund) => ({
          refund: priorRefund,
          entries: await repositories.ledgerEntries.findByTransactionGroupId(
            priorRefund.transactionGroupId,
          ),
        })),
      );
      const remainingBeforeRefund = calculateRemainingRefundableAmount(
        order,
        originalPair,
        priorRefundLedgerGroups,
        orderEntries,
      );

      if (parsedCommand.tokenAmount > remainingBeforeRefund) {
        throw new RefundServiceError("REFUND_AMOUNT_EXCEEDS_REMAINING");
      }

      const customerBalance = calculateNonNegativeRefundWalletBalance(
        customerWalletEntries,
        "REFUND_CUSTOMER_BALANCE_INVALID",
      );
      const vendorBalance = calculateNonNegativeRefundWalletBalance(
        vendorWalletEntries,
        "REFUND_VENDOR_BALANCE_INVALID",
      );

      try {
        calculateProjectedWalletBalance(
          customerBalance,
          "credit",
          parsedCommand.tokenAmount,
        );
      } catch {
        throw new RefundServiceError("REFUND_CUSTOMER_BALANCE_OVERFLOW");
      }

      try {
        calculateProjectedWalletBalance(
          vendorBalance,
          "debit",
          parsedCommand.tokenAmount,
        );
      } catch (error: unknown) {
        if (error instanceof InsufficientWalletBalanceError) {
          throw new RefundServiceError("REFUND_VENDOR_BALANCE_INSUFFICIENT");
        }

        throw new RefundServiceError("REFUND_VENDOR_BALANCE_INVALID");
      }

      const remainingRefundableTokenAmount =
        remainingBeforeRefund - parsedCommand.tokenAmount;
      const refundScope =
        remainingRefundableTokenAmount === 0 ? "full" : "partial";
      const refund = Object.freeze(
        refundSchema.parse({
          id: refundId,
          reference,
          orderId: order.id,
          customerId: order.customerId,
          vendorId: order.vendorId,
          tokenAmount: parsedCommand.tokenAmount,
          reason: parsedCommand.reason,
          actorAccountId: actor.id,
          transactionGroupId,
          idempotencyKey: parsedCommand.idempotencyKey,
          createdAt: occurredAt,
        }),
      );
      const customerLedgerEntry = Object.freeze(
        ledgerEntrySchema.parse({
          id: customerLedgerEntryId,
          walletId: order.customerWalletId,
          transactionGroupId,
          entryType: "customer_refund",
          direction: "credit",
          tokenAmount: parsedCommand.tokenAmount,
          actorAccountId: actor.id,
          relatedCustomerId: order.customerId,
          relatedVendorId: order.vendorId,
          relatedOrderId: order.id,
          relatedEvidenceId: null,
          reference,
          description: "Customer wallet credit for completed order refund.",
          occurredAt,
          idempotencyKey: customerCreditIdempotencyKey,
          metadata: {
            pairedLedgerEntryId: vendorLedgerEntryId,
            refundId,
            reason: parsedCommand.reason,
            refundScope,
            source: "refund_service",
          },
          reversesLedgerEntryId: originalPair.customerDebit.id,
        }),
      );
      const vendorLedgerEntry = Object.freeze(
        ledgerEntrySchema.parse({
          id: vendorLedgerEntryId,
          walletId: order.vendorWalletId,
          transactionGroupId,
          entryType: "vendor_refund",
          direction: "debit",
          tokenAmount: parsedCommand.tokenAmount,
          actorAccountId: actor.id,
          relatedCustomerId: order.customerId,
          relatedVendorId: order.vendorId,
          relatedOrderId: order.id,
          relatedEvidenceId: null,
          reference,
          description: "Vendor wallet debit for completed order refund.",
          occurredAt,
          idempotencyKey: vendorDebitIdempotencyKey,
          metadata: {
            pairedLedgerEntryId: customerLedgerEntryId,
            refundId,
            reason: parsedCommand.reason,
            refundScope,
            source: "refund_service",
          },
          reversesLedgerEntryId: originalPair.vendorCredit.id,
        }),
      );
      const auditLog = prepareAuditLog(
        {
          eventType: "refund_created",
          actorAccountId: actor.id,
          targetType: "refund",
          targetId: refund.id,
          description: `${refundScope === "full" ? "Full" : "Partial"} order refund recorded by vendor.`,
          metadata: {
            orderId: order.id,
            customerId: order.customerId,
            vendorId: order.vendorId,
            tokenAmount: parsedCommand.tokenAmount,
            remainingRefundableTokenAmount,
            refundScope,
          },
          transactionGroupId,
        },
        {
          id: auditLogId,
          occurredAt,
        },
      );

      await repositories.refunds.create(refund);
      await repositories.ledgerEntries.append(customerLedgerEntry);
      await repositories.ledgerEntries.append(vendorLedgerEntry);
      await repositories.auditLogs.append(auditLog);

      return Object.freeze({
        refund,
        customerLedgerEntry,
        vendorLedgerEntry,
        auditLog,
        remainingRefundableTokenAmount,
      });
    });
  }
}
