import type { AccountRepository } from "@/modules/accounts";
import { prepareAuditLog, type AuditLogRepository } from "@/modules/audit-logs";
import type { CustomerRepository } from "@/modules/customers";
import type { Product, ProductRepository } from "@/modules/products";
import {
  assertNonNegativeWalletBalance,
  assertTransactionGroupIdAvailable,
  calculateProjectedWalletBalance,
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  DuplicateTransactionGroupIdError,
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

import type { Order, OrderItem } from "./order";
import type { OrderRepository } from "./order-repository";
import { orderSchema } from "./order-schema";
import {
  type PurchaseCommand,
  purchaseCommandSchema,
} from "./purchase-command-schema";
import { PurchaseServiceError } from "./purchase-service-error";

export interface PurchaseAuthorizationRequest {
  readonly actorAccountId: string;
  readonly customerId: string;
  readonly vendorId: string;
}

/**
 * A one-attempt authorization hook supplied by the calling boundary.
 *
 * Phase 4 can close over the submitted PIN and call PinVerificationService
 * here. Tokenly invokes this hook before opening the IndexedDB transaction, and
 * neither the command nor any persisted purchase record contains the PIN.
 * Rejections are propagated unchanged so authentication keeps its own typed
 * failure and lockout semantics.
 */
export type PurchaseAuthorizationCallback = (
  request: PurchaseAuthorizationRequest,
) => Promise<void>;

export interface PurchaseTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getById">;
  readonly ledgerEntries: Pick<
    LedgerEntryRepository,
    | "append"
    | "findByTransactionGroupId"
    | "findByWalletId"
    | "getByIdempotencyKey"
  >;
  readonly orders: Pick<OrderRepository, "create" | "getByIdempotencyKey">;
  readonly products: Pick<ProductRepository, "getById">;
  readonly vendors: Pick<VendorRepository, "getById">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export interface PurchaseServiceDependencies {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly referenceProvider: TransactionReferenceProvider;
  readonly transactionGroupIdProvider: TransactionGroupIdProvider;
  readonly transactionRunner: RepositoryTransactionRunner<PurchaseTransactionRepositories>;
}

export interface PurchaseReceipt {
  readonly orderId: string;
  readonly reference: string;
  readonly customerId: string;
  readonly vendorId: string;
  readonly vendorDisplayName: string;
  readonly items: readonly OrderItem[];
  readonly tokenTotal: number;
  readonly completedAt: string;
  readonly transactionGroupId: string;
}

interface PurchaseRecordIdentity {
  readonly auditLogId: string;
  readonly customerDebitLedgerEntryId: string;
  readonly orderId: string;
  readonly orderReference: string;
  readonly transactionGroupId: string;
  readonly vendorCreditLedgerEntryId: string;
}

function createPurchaseIdentity(
  dependencies: PurchaseServiceDependencies,
): PurchaseRecordIdentity {
  const identity = {
    auditLogId: dependencies.idProvider.generateId("audit-log"),
    customerDebitLedgerEntryId:
      dependencies.idProvider.generateId("ledger-entry"),
    orderId: dependencies.idProvider.generateId("order"),
    orderReference: dependencies.referenceProvider.generateReference("order"),
    transactionGroupId:
      dependencies.transactionGroupIdProvider.generateTransactionGroupId(),
    vendorCreditLedgerEntryId:
      dependencies.idProvider.generateId("ledger-entry"),
  } satisfies PurchaseRecordIdentity;

  const recordIds = [
    identity.auditLogId,
    identity.customerDebitLedgerEntryId,
    identity.orderId,
    identity.vendorCreditLedgerEntryId,
  ];

  if (new Set(recordIds).size !== recordIds.length) {
    throw new PurchaseServiceError("PURCHASE_RECORD_IDENTITY_INVALID");
  }

  return identity;
}

function createAuthoritativeOrderItems(
  command: PurchaseCommand,
  products: ReadonlyMap<string, Product>,
): readonly OrderItem[] {
  let tokenTotal = 0;

  const items = command.items.map((commandItem) => {
    const product = products.get(commandItem.productId);

    if (
      product === undefined ||
      product.vendorId !== command.vendorId ||
      !product.isAvailable ||
      product.isSoldOut ||
      product.isArchived
    ) {
      throw new PurchaseServiceError("PURCHASE_PRODUCT_UNAVAILABLE");
    }

    if (
      commandItem.quantity >
      Math.floor(Number.MAX_SAFE_INTEGER / product.tokenPrice)
    ) {
      throw new PurchaseServiceError("PURCHASE_TOTAL_OUT_OF_RANGE");
    }

    const lineTokenTotal = product.tokenPrice * commandItem.quantity;

    if (tokenTotal > Number.MAX_SAFE_INTEGER - lineTokenTotal) {
      throw new PurchaseServiceError("PURCHASE_TOTAL_OUT_OF_RANGE");
    }

    tokenTotal += lineTokenTotal;

    return {
      productId: product.id,
      productName: product.name,
      unitTokenPrice: product.tokenPrice,
      quantity: commandItem.quantity,
      lineTokenTotal,
      displayOrder: product.displayOrder,
    } satisfies OrderItem;
  });

  return items
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.productId.localeCompare(right.productId),
    )
    .map((item) => Object.freeze(item));
}

function calculateOrderTokenTotal(items: readonly OrderItem[]): number {
  let total = 0;

  for (const item of items) {
    if (total > Number.MAX_SAFE_INTEGER - item.lineTokenTotal) {
      throw new PurchaseServiceError("PURCHASE_TOTAL_OUT_OF_RANGE");
    }

    total += item.lineTokenTotal;
  }

  if (total <= 0) {
    throw new PurchaseServiceError("PURCHASE_TOTAL_OUT_OF_RANGE");
  }

  return total;
}

function freezeOrder(order: Order): Order {
  Object.freeze(order.items);
  return Object.freeze(order);
}

function createReceipt(
  order: Order,
  vendorDisplayName: string,
): PurchaseReceipt {
  return Object.freeze({
    orderId: order.id,
    reference: order.reference,
    customerId: order.customerId,
    vendorId: order.vendorId,
    vendorDisplayName,
    items: order.items,
    tokenTotal: order.tokenTotal,
    completedAt: order.completedAt,
    transactionGroupId: order.transactionGroupId,
  });
}

function calculateNonNegativeWalletBalance(
  entries: readonly LedgerEntry[],
  errorCode:
    "PURCHASE_CUSTOMER_WALLET_INVALID" | "PURCHASE_VENDOR_WALLET_INVALID",
): number {
  try {
    const balance = calculateWalletBalance(entries);
    assertNonNegativeWalletBalance(balance);
    return balance;
  } catch {
    throw new PurchaseServiceError(errorCode);
  }
}

function assertVendorCreditIsSafe(
  currentBalance: number,
  tokenAmount: number,
): void {
  try {
    calculateProjectedWalletBalance(currentBalance, "credit", tokenAmount);
  } catch {
    throw new PurchaseServiceError("PURCHASE_VENDOR_BALANCE_OVERFLOW");
  }
}

export class PurchaseService {
  public constructor(
    private readonly dependencies: PurchaseServiceDependencies,
  ) {}

  public async completePurchase(
    input: unknown,
    authorize: PurchaseAuthorizationCallback,
  ): Promise<PurchaseReceipt> {
    const parsedCommand = purchaseCommandSchema.safeParse(input);

    if (!parsedCommand.success) {
      throw new PurchaseServiceError("PURCHASE_INVALID_COMMAND");
    }

    const command = parsedCommand.data;

    await authorize(
      Object.freeze({
        actorAccountId: command.actorAccountId,
        customerId: command.customerId,
        vendorId: command.vendorId,
      }),
    );

    // Identity, time, and reference creation are deliberately completed before
    // opening IndexedDB; only repository operations are awaited in the unit of
    // work so browsers cannot auto-commit during an unrelated asynchronous gap.
    const identity = createPurchaseIdentity(this.dependencies);
    const completedAt = this.dependencies.clock.now();
    const operationLedgerIdempotencyKey = createOperationLedgerIdempotencyKey(
      command.idempotencyKey,
    );
    const vendorCreditIdempotencyKey = createScopedLedgerIdempotencyKey(
      command.idempotencyKey,
      "vendor-credit",
    );

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const [actorAccount, customer, vendor] = await Promise.all([
        repositories.accounts.getById(command.actorAccountId),
        repositories.customers.getById(command.customerId),
        repositories.vendors.getById(command.vendorId),
      ]);

      if (
        actorAccount === null ||
        actorAccount.status !== "active" ||
        actorAccount.role !== "customer"
      ) {
        throw new PurchaseServiceError("PURCHASE_ACTOR_NOT_AUTHORIZED");
      }

      if (customer === null || customer.accountId !== actorAccount.id) {
        throw new PurchaseServiceError("PURCHASE_CUSTOMER_UNAVAILABLE");
      }

      if (vendor === null) {
        throw new PurchaseServiceError("PURCHASE_VENDOR_UNAVAILABLE");
      }

      if (vendor.operatingStatus !== "open") {
        throw new PurchaseServiceError("PURCHASE_VENDOR_CLOSED");
      }

      const [
        vendorAccount,
        customerWallet,
        vendorWallet,
        existingOrder,
        existingCustomerDebit,
        existingVendorCredit,
        customerLedgerEntries,
        vendorLedgerEntries,
        ...loadedProducts
      ] = await Promise.all([
        repositories.accounts.getById(vendor.accountId),
        repositories.wallets.getById(customer.walletId),
        repositories.wallets.getById(vendor.walletId),
        repositories.orders.getByIdempotencyKey(command.idempotencyKey),
        repositories.ledgerEntries.getByIdempotencyKey(
          operationLedgerIdempotencyKey,
        ),
        repositories.ledgerEntries.getByIdempotencyKey(
          vendorCreditIdempotencyKey,
        ),
        repositories.ledgerEntries.findByWalletId(customer.walletId),
        repositories.ledgerEntries.findByWalletId(vendor.walletId),
        ...command.items.map(({ productId }) =>
          repositories.products.getById(productId),
        ),
      ]);

      if (
        vendorAccount === null ||
        vendorAccount.status !== "active" ||
        vendorAccount.role !== "vendor" ||
        vendorAccount.id !== vendor.accountId
      ) {
        throw new PurchaseServiceError("PURCHASE_VENDOR_UNAVAILABLE");
      }

      if (
        customerWallet === null ||
        customerWallet.status !== "active" ||
        customerWallet.ownerType !== "customer" ||
        customerWallet.ownerAccountId !== actorAccount.id
      ) {
        throw new PurchaseServiceError("PURCHASE_CUSTOMER_WALLET_UNAVAILABLE");
      }

      if (
        vendorWallet === null ||
        vendorWallet.status !== "active" ||
        vendorWallet.ownerType !== "vendor" ||
        vendorWallet.ownerAccountId !== vendorAccount.id
      ) {
        throw new PurchaseServiceError("PURCHASE_VENDOR_WALLET_UNAVAILABLE");
      }

      if (
        existingOrder !== null ||
        existingCustomerDebit !== null ||
        existingVendorCredit !== null
      ) {
        throw new PurchaseServiceError("PURCHASE_DUPLICATE_SUBMISSION");
      }

      try {
        await assertTransactionGroupIdAvailable(
          repositories.ledgerEntries,
          identity.transactionGroupId,
        );
      } catch (error: unknown) {
        if (error instanceof DuplicateTransactionGroupIdError) {
          throw new PurchaseServiceError(
            "PURCHASE_TRANSACTION_GROUP_COLLISION",
          );
        }

        throw error;
      }

      const products = new Map<string, Product>();

      for (const product of loadedProducts) {
        if (product !== null) {
          products.set(product.id, product);
        }
      }

      const items = createAuthoritativeOrderItems(command, products);
      const tokenTotal = calculateOrderTokenTotal(items);
      const customerBalance = calculateNonNegativeWalletBalance(
        customerLedgerEntries,
        "PURCHASE_CUSTOMER_WALLET_INVALID",
      );
      const vendorBalance = calculateNonNegativeWalletBalance(
        vendorLedgerEntries,
        "PURCHASE_VENDOR_WALLET_INVALID",
      );

      if (tokenTotal > customerBalance) {
        throw new PurchaseServiceError("PURCHASE_INSUFFICIENT_BALANCE");
      }

      assertVendorCreditIsSafe(vendorBalance, tokenTotal);

      const order = freezeOrder(
        orderSchema.parse({
          id: identity.orderId,
          reference: identity.orderReference,
          customerId: customer.id,
          vendorId: vendor.id,
          customerWalletId: customerWallet.id,
          vendorWalletId: vendorWallet.id,
          status: "completed",
          items,
          tokenTotal,
          transactionGroupId: identity.transactionGroupId,
          idempotencyKey: command.idempotencyKey,
          completedAt,
        }),
      );

      const customerDebit = Object.freeze(
        ledgerEntrySchema.parse({
          id: identity.customerDebitLedgerEntryId,
          walletId: customerWallet.id,
          transactionGroupId: identity.transactionGroupId,
          entryType: "customer_purchase",
          direction: "debit",
          tokenAmount: tokenTotal,
          actorAccountId: actorAccount.id,
          relatedCustomerId: customer.id,
          relatedVendorId: vendor.id,
          relatedOrderId: order.id,
          relatedEvidenceId: null,
          reference: order.reference,
          description: "Customer wallet debit for completed order.",
          occurredAt: completedAt,
          idempotencyKey: operationLedgerIdempotencyKey,
          metadata: {
            pairedLedgerEntryId: identity.vendorCreditLedgerEntryId,
            source: "purchase_service",
          },
          reversesLedgerEntryId: null,
        }) satisfies LedgerEntry,
      );

      const vendorCredit = Object.freeze(
        ledgerEntrySchema.parse({
          id: identity.vendorCreditLedgerEntryId,
          walletId: vendorWallet.id,
          transactionGroupId: identity.transactionGroupId,
          entryType: "vendor_receipt",
          direction: "credit",
          tokenAmount: tokenTotal,
          actorAccountId: actorAccount.id,
          relatedCustomerId: customer.id,
          relatedVendorId: vendor.id,
          relatedOrderId: order.id,
          relatedEvidenceId: null,
          reference: order.reference,
          description: "Vendor wallet credit for completed order.",
          occurredAt: completedAt,
          idempotencyKey: vendorCreditIdempotencyKey,
          metadata: {
            pairedLedgerEntryId: identity.customerDebitLedgerEntryId,
            source: "purchase_service",
          },
          reversesLedgerEntryId: null,
        }) satisfies LedgerEntry,
      );

      const itemCount = order.items.reduce(
        (count, item) => count + item.quantity,
        0,
      );
      const auditLog = prepareAuditLog(
        {
          eventType: "purchase_completed",
          actorAccountId: actorAccount.id,
          targetType: "order",
          targetId: order.id,
          description: "Customer purchase completed.",
          metadata: {
            itemCount,
            productCount: order.items.length,
            source: "purchase_service",
            tokenAmount: tokenTotal,
          },
          transactionGroupId: identity.transactionGroupId,
        },
        {
          id: identity.auditLogId,
          occurredAt: completedAt,
        },
      );

      await repositories.orders.create(order);
      await repositories.ledgerEntries.append(customerDebit);
      await repositories.ledgerEntries.append(vendorCredit);
      await repositories.auditLogs.append(auditLog);

      return createReceipt(order, vendor.displayName);
    });
  }
}
