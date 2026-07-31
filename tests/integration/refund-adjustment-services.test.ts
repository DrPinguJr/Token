import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Account, AccountPinCredential } from "@/modules/accounts";
import type { Customer } from "@/modules/customers";
import type { Order } from "@/modules/orders";
import { RefundService, type RefundTransactionRunner } from "@/modules/refunds";
import { calculateVendorEarnedTokens } from "@/modules/settlements";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  type LedgerEntry,
  type TransactionIdProvider,
  type TransactionReferenceProvider,
} from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import {
  AdministrativeAdjustmentService,
  calculateWalletBalance,
  type AdministrativeAdjustmentTransactionRunner,
  type Wallet,
} from "@/modules/wallets";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositories,
} from "@/config/local-repositories";
import { closeTokenlyDatabaseConnections } from "@/shared/data";

const initialTimestamp = "2026-07-25T09:00:00.000Z";
const purchaseTimestamp = "2026-07-25T10:00:00.000Z";
const mutationTimestamp = "2026-07-25T12:00:00.000Z";

const customerAccount: Account = {
  id: "account-customer-integration",
  mobileNumber: "91111111",
  displayName: "Integration Customer",
  role: "customer",
  status: "active",
  createdAt: initialTimestamp,
  updatedAt: initialTimestamp,
};

const vendorAccount: Account = {
  id: "account-vendor-integration",
  mobileNumber: "92222222",
  displayName: "Integration Vendor Account",
  role: "vendor",
  status: "active",
  createdAt: initialTimestamp,
  updatedAt: initialTimestamp,
};

const administratorAccount: Account = {
  id: "account-administrator-integration",
  mobileNumber: "93333333",
  displayName: "Integration Administrator",
  role: "administrator",
  status: "active",
  createdAt: initialTimestamp,
  updatedAt: initialTimestamp,
};

function createCredential(accountId: string): AccountPinCredential {
  return {
    accountId,
    pinCredential: "prototype-test-credential",
    failedPinAttempts: 0,
    lockedUntil: null,
  };
}

const customerWallet: Wallet = {
  id: "wallet-customer-integration",
  ownerAccountId: customerAccount.id,
  ownerType: "customer",
  status: "active",
  createdAt: initialTimestamp,
};

const customer: Customer = {
  id: "customer-integration",
  accountId: customerAccount.id,
  walletId: customerWallet.id,
  publicCode: "cus_INTEGRATION",
  onboardingCompletedAt: initialTimestamp,
  createdAt: initialTimestamp,
  updatedAt: initialTimestamp,
};

const vendorWallet: Wallet = {
  id: "wallet-vendor-integration",
  ownerAccountId: vendorAccount.id,
  ownerType: "vendor",
  status: "active",
  createdAt: initialTimestamp,
};

const vendor: Vendor = {
  id: "vendor-integration",
  accountId: vendorAccount.id,
  walletId: vendorWallet.id,
  publicCode: "vnd_INTEGRATION",
  displayName: "Integration Vendor",
  logo: null,
  banner: null,
  description: "Fictional integration-test vendor.",
  stallLocation: "Integration Hall",
  operatingStatus: "open",
  createdAt: initialTimestamp,
  updatedAt: initialTimestamp,
};

const order: Order = {
  id: "order-integration",
  reference: "ORD-INTEGRATION",
  customerId: customer.id,
  vendorId: vendor.id,
  customerWalletId: customerWallet.id,
  vendorWalletId: vendorWallet.id,
  status: "completed",
  items: [
    {
      productId: "product-integration",
      productName: "Integration Product",
      unitTokenPrice: 30,
      quantity: 1,
      lineTokenTotal: 30,
      displayOrder: 0,
    },
  ],
  tokenTotal: 30,
  transactionGroupId: "transaction-purchase-integration",
  idempotencyKey: "test:purchase:integration",
  completedAt: purchaseTimestamp,
};

const customerIssuanceCredit: LedgerEntry = {
  id: "ledger-issuance-integration",
  walletId: customerWallet.id,
  transactionGroupId: "transaction-issuance-integration",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 40,
  actorAccountId: administratorAccount.id,
  relatedCustomerId: customer.id,
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: "evidence-issuance-integration",
  reference: "ISS-INTEGRATION",
  description: "Integration-test opening customer credit.",
  occurredAt: initialTimestamp,
  idempotencyKey: createOperationLedgerIdempotencyKey(
    "test:issuance:integration",
  ),
  metadata: {},
  reversesLedgerEntryId: null,
};

const customerPurchaseDebit: LedgerEntry = {
  id: "ledger-purchase-customer-integration",
  walletId: customerWallet.id,
  transactionGroupId: order.transactionGroupId,
  entryType: "customer_purchase",
  direction: "debit",
  tokenAmount: order.tokenTotal,
  actorAccountId: customerAccount.id,
  relatedCustomerId: customer.id,
  relatedVendorId: vendor.id,
  relatedOrderId: order.id,
  relatedEvidenceId: null,
  reference: order.reference,
  description: "Integration-test customer purchase debit.",
  occurredAt: purchaseTimestamp,
  idempotencyKey: createOperationLedgerIdempotencyKey(order.idempotencyKey),
  metadata: {
    pairedLedgerEntryId: "ledger-purchase-vendor-integration",
    source: "purchase_service",
  },
  reversesLedgerEntryId: null,
};

const vendorPurchaseCredit: LedgerEntry = {
  ...customerPurchaseDebit,
  id: "ledger-purchase-vendor-integration",
  walletId: vendorWallet.id,
  entryType: "vendor_receipt",
  direction: "credit",
  description: "Integration-test vendor purchase credit.",
  idempotencyKey: createScopedLedgerIdempotencyKey(
    order.idempotencyKey,
    "vendor-credit",
  ),
  metadata: {
    pairedLedgerEntryId: customerPurchaseDebit.id,
    source: "purchase_service",
  },
};

function createIdProvider(): TransactionIdProvider {
  const counts = new Map<string, number>();

  return {
    generateId: (recordType) => {
      const count = (counts.get(recordType) ?? 0) + 1;
      counts.set(recordType, count);
      return `${recordType}-integration-${count}`;
    },
  };
}

function createReferenceProvider(): TransactionReferenceProvider {
  let count = 0;

  return {
    generateReference: (referenceType) => {
      count += 1;
      return `${referenceType.toUpperCase()}-INTEGRATION-${count}`;
    },
  };
}

let databaseCount = 0;
let databaseName = "";
let repositories: LocalRepositories;

beforeEach(async () => {
  databaseCount += 1;
  databaseName = `tokenly-refund-adjustment-integration-${databaseCount}`;
  repositories = await createLocalRepositories({ databaseName });

  await repositories.accounts.create(
    customerAccount,
    createCredential(customerAccount.id),
  );
  await repositories.accounts.create(
    vendorAccount,
    createCredential(vendorAccount.id),
  );
  await repositories.accounts.create(
    administratorAccount,
    createCredential(administratorAccount.id),
  );
  await repositories.customers.create(customer);
  await repositories.wallets.create(customerWallet);
  await repositories.wallets.create(vendorWallet);
  await repositories.vendors.create(vendor);
  await repositories.orders.create(order);
  await repositories.ledgerEntries.append(customerIssuanceCredit);
  await repositories.ledgerEntries.append(customerPurchaseDebit);
  await repositories.ledgerEntries.append(vendorPurchaseCredit);
});

afterEach(async () => {
  await repositories.close();
  await deleteDB(databaseName);
  await closeTokenlyDatabaseConnections();
});

function createRefundService(
  transactionRunner: RefundTransactionRunner = {
    run: (work) =>
      runInLocalRepositoryTransaction(
        (transactionRepositories) => work(transactionRepositories),
        { databaseName },
      ),
  },
): RefundService {
  let transactionGroupCount = 0;

  return new RefundService({
    authorize: vi.fn(async () => undefined),
    clock: { now: () => mutationTimestamp },
    idProvider: createIdProvider(),
    referenceProvider: createReferenceProvider(),
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => {
        transactionGroupCount += 1;
        return `transaction-refund-integration-${transactionGroupCount}`;
      },
    },
    transactionRunner,
  });
}

function createAdjustmentService(
  transactionRunner: AdministrativeAdjustmentTransactionRunner = {
    run: (work) =>
      runInLocalRepositoryTransaction(
        (transactionRepositories) => work(transactionRepositories),
        { databaseName },
      ),
  },
): AdministrativeAdjustmentService {
  let transactionGroupCount = 0;

  return new AdministrativeAdjustmentService({
    clock: { now: () => mutationTimestamp },
    idProvider: createIdProvider(),
    referenceProvider: createReferenceProvider(),
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => {
        transactionGroupCount += 1;
        return `transaction-adjustment-integration-${transactionGroupCount}`;
      },
    },
    transactionRunner,
  });
}

describe("refund and adjustment IndexedDB integration", () => {
  it("atomically persists partial and full refunds linked to unchanged originals", async () => {
    const service = createRefundService();

    const partial = await service.createRefund({
      actorAccountId: administratorAccount.id,
      orderId: order.id,
      tokenAmount: 12,
      reason: "Part of the integration order was unavailable.",
      idempotencyKey: "test:refund:integration:partial",
    });
    const full = await service.createRefund({
      actorAccountId: administratorAccount.id,
      orderId: order.id,
      tokenAmount: 18,
      reason: "The remainder of the integration order was cancelled.",
      idempotencyKey: "test:refund:integration:full",
    });

    const persistedRefunds = await repositories.refunds.findByOrderId(order.id);
    const persistedOrderEntries =
      await repositories.ledgerEntries.findByRelatedOrderId(order.id);
    const persistedOrder = await repositories.orders.getById(order.id);

    expect(partial.remainingRefundableTokenAmount).toBe(18);
    expect(full.remainingRefundableTokenAmount).toBe(0);
    expect(persistedRefunds).toHaveLength(2);
    expect(persistedOrderEntries).toHaveLength(6);
    expect(
      persistedOrderEntries.filter(
        ({ entryType }) => entryType === "customer_refund",
      ),
    ).toHaveLength(2);
    expect(
      persistedOrderEntries.filter(
        ({ entryType }) => entryType === "vendor_refund",
      ),
    ).toHaveLength(2);
    expect(full.customerLedgerEntry.reversesLedgerEntryId).toBe(
      customerPurchaseDebit.id,
    );
    expect(full.vendorLedgerEntry.reversesLedgerEntryId).toBe(
      vendorPurchaseCredit.id,
    );
    expect(persistedOrder).toEqual(order);
    expect(
      await repositories.ledgerEntries.getById(customerPurchaseDebit.id),
    ).toEqual(customerPurchaseDebit);
    expect(
      await repositories.ledgerEntries.getById(vendorPurchaseCredit.id),
    ).toEqual(vendorPurchaseCredit);
    expect(
      await repositories.auditLogs.findByTransactionGroupId(
        full.refund.transactionGroupId,
      ),
    ).toEqual([full.auditLog]);
  });

  it("rejects an over-refund without committing any related record", async () => {
    const service = createRefundService();
    const ledgerCountBefore = (
      await repositories.ledgerEntries.findByRelatedOrderId(order.id)
    ).length;

    await expect(
      service.createRefund({
        actorAccountId: administratorAccount.id,
        orderId: order.id,
        tokenAmount: 31,
        reason: "Attempted integration over-refund.",
        idempotencyKey: "test:refund:integration:over",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDS_REMAINING",
    });

    expect(await repositories.refunds.findByOrderId(order.id)).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByRelatedOrderId(order.id),
    ).toHaveLength(ledgerCountBefore);
    expect(
      await repositories.auditLogs.list({ eventType: "refund_created" }),
    ).toEqual([]);
  });

  it("serializes concurrent distinct-key refunds so their combined amount cannot over-refund", async () => {
    const service = createRefundService();
    const results = await Promise.allSettled([
      service.createRefund({
        actorAccountId: administratorAccount.id,
        orderId: order.id,
        tokenAmount: 20,
        reason: "First competing integration refund.",
        idempotencyKey: "test:refund:integration:concurrent:first",
      }),
      service.createRefund({
        actorAccountId: administratorAccount.id,
        orderId: order.id,
        tokenAmount: 20,
        reason: "Second competing integration refund.",
        idempotencyKey: "test:refund:integration:concurrent:second",
      }),
    ]);
    const fulfilledResults = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<RefundService["createRefund"]>>
      > => result.status === "fulfilled",
    );
    const rejectedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]?.reason).toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDS_REMAINING",
    });

    const persistedRefunds = await repositories.refunds.findByOrderId(order.id);
    const persistedOrderEntries =
      await repositories.ledgerEntries.findByRelatedOrderId(order.id);

    expect(persistedRefunds).toHaveLength(1);
    expect(persistedRefunds[0]?.tokenAmount).toBe(20);
    expect(
      persistedOrderEntries.filter(
        ({ entryType }) =>
          entryType === "customer_refund" || entryType === "vendor_refund",
      ),
    ).toHaveLength(2);
    expect(
      await repositories.auditLogs.list({ eventType: "refund_created" }),
    ).toHaveLength(1);
  });

  it("rolls back refund records and ledger entries when audit append fails", async () => {
    const failingRunner: RefundTransactionRunner = {
      run: (work) =>
        runInLocalRepositoryTransaction(
          (transactionRepositories) =>
            work({
              ...transactionRepositories,
              auditLogs: {
                append: async () => {
                  throw new Error("simulated audit append failure");
                },
              },
            }),
          { databaseName },
        ),
    };
    const service = createRefundService(failingRunner);

    await expect(
      service.createRefund({
        actorAccountId: administratorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Atomic rollback integration test.",
        idempotencyKey: "test:refund:integration:rollback",
      }),
    ).rejects.toThrow("simulated audit append failure");

    expect(await repositories.refunds.findByOrderId(order.id)).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByRelatedOrderId(order.id),
    ).toEqual([customerPurchaseDebit, vendorPurchaseCredit]);
  });

  it("persists administrator credit and debit adjustments with audit history", async () => {
    const service = createAdjustmentService();

    const credit = await service.createAdjustment({
      actorAccountId: administratorAccount.id,
      walletId: customerWallet.id,
      direction: "credit",
      tokenAmount: 5,
      reason: "Integration desk reconciliation credit.",
      idempotencyKey: "test:adjustment:integration:credit",
    });
    const debit = await service.createAdjustment({
      actorAccountId: administratorAccount.id,
      walletId: customerWallet.id,
      direction: "debit",
      tokenAmount: 3,
      reason: "Integration desk reconciliation debit.",
      idempotencyKey: "test:adjustment:integration:debit",
    });
    const customerEntries = await repositories.ledgerEntries.findByWalletId(
      customerWallet.id,
    );

    expect(credit.resultingBalance).toBe(15);
    expect(debit.resultingBalance).toBe(12);
    expect(calculateWalletBalance(customerEntries)).toBe(12);
    expect(
      customerEntries.filter(
        ({ entryType }) => entryType === "administrative_adjustment",
      ),
    ).toHaveLength(2);
    expect(
      await repositories.auditLogs.findByTransactionGroupId(
        debit.ledgerEntry.transactionGroupId,
      ),
    ).toEqual([debit.auditLog]);
  });

  it("serializes concurrent distinct-key debit adjustments so they cannot overdraw", async () => {
    const service = createAdjustmentService();
    const results = await Promise.allSettled([
      service.createAdjustment({
        actorAccountId: administratorAccount.id,
        walletId: customerWallet.id,
        direction: "debit",
        tokenAmount: 7,
        reason: "First competing integration debit.",
        idempotencyKey: "test:adjustment:integration:concurrent:first",
      }),
      service.createAdjustment({
        actorAccountId: administratorAccount.id,
        walletId: customerWallet.id,
        direction: "debit",
        tokenAmount: 7,
        reason: "Second competing integration debit.",
        idempotencyKey: "test:adjustment:integration:concurrent:second",
      }),
    ]);
    const fulfilledResults = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<AdministrativeAdjustmentService["createAdjustment"]>>
      > => result.status === "fulfilled",
    );
    const rejectedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]?.reason).toMatchObject({
      code: "ADJUSTMENT_WALLET_BALANCE_INSUFFICIENT",
    });

    const walletEntries = await repositories.ledgerEntries.findByWalletId(
      customerWallet.id,
    );

    expect(calculateWalletBalance(walletEntries)).toBe(3);
    expect(
      walletEntries.filter(
        ({ entryType }) => entryType === "administrative_adjustment",
      ),
    ).toHaveLength(1);
    expect(
      await repositories.auditLogs.list({
        eventType: "administrative_adjustment_created",
      }),
    ).toHaveLength(1);
  });

  it("rolls back an adjustment ledger entry when audit persistence fails", async () => {
    const failingRunner: AdministrativeAdjustmentTransactionRunner = {
      run: (work) =>
        runInLocalRepositoryTransaction(
          (transactionRepositories) =>
            work({
              ...transactionRepositories,
              auditLogs: {
                append: async () => {
                  throw new Error("simulated adjustment audit append failure");
                },
              },
            }),
          { databaseName },
        ),
    };
    const service = createAdjustmentService(failingRunner);

    await expect(
      service.createAdjustment({
        actorAccountId: administratorAccount.id,
        walletId: customerWallet.id,
        direction: "credit",
        tokenAmount: 5,
        reason: "Atomic adjustment rollback integration test.",
        idempotencyKey: "test:adjustment:integration:rollback",
      }),
    ).rejects.toThrow("simulated adjustment audit append failure");

    const walletEntries = await repositories.ledgerEntries.findByWalletId(
      customerWallet.id,
    );

    expect(calculateWalletBalance(walletEntries)).toBe(10);
    expect(
      walletEntries.filter(
        ({ entryType }) => entryType === "administrative_adjustment",
      ),
    ).toEqual([]);
    expect(
      await repositories.auditLogs.list({
        eventType: "administrative_adjustment_created",
      }),
    ).toEqual([]);
  });

  it("calculates settlement earnings from persisted receipts minus refunds", async () => {
    const service = createRefundService();

    await service.createRefund({
      actorAccountId: administratorAccount.id,
      orderId: order.id,
      tokenAmount: 8,
      reason: "Settlement integration calculation refund.",
      idempotencyKey: "test:refund:integration:settlement",
    });

    expect(
      calculateVendorEarnedTokens({
        vendorId: vendor.id,
        vendorWalletId: vendorWallet.id,
        periodStart: "2026-07-25T00:00:00.000Z",
        periodEnd: "2026-07-26T00:00:00.000Z",
        ledgerEntries: await repositories.ledgerEntries.list(),
      }),
    ).toBe(22);
  });
});
