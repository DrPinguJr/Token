import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Account, AccountPinCredential } from "@/modules/accounts";
import { assertSafeAuditMetadata } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import {
  PurchaseService,
  PurchaseServiceError,
  type PurchaseAuthorizationCallback,
  type PurchaseServiceDependencies,
  type PurchaseTransactionRepositories,
} from "@/modules/orders";
import type { Product } from "@/modules/products";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  type LedgerEntry,
  type RepositoryTransactionRunner,
} from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import { calculateWalletBalance, type Wallet } from "@/modules/wallets";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositories,
} from "@/config/local-repositories";

const occurredAt = "2026-07-27T03:00:00.000Z";

const customerAccount: Account = {
  id: "account-customer-purchase-integration",
  mobileNumber: "93333333",
  displayName: "Integration Customer",
  role: "customer",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customerCredential: AccountPinCredential = {
  accountId: customerAccount.id,
  pinCredential: "prototype-integration-credential",
  failedPinAttempts: 0,
  lockedUntil: null,
};

const vendorAccount: Account = {
  id: "account-vendor-purchase-integration",
  mobileNumber: "94444444",
  displayName: "Integration Vendor Account",
  role: "vendor",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const vendorCredential: AccountPinCredential = {
  accountId: vendorAccount.id,
  pinCredential: "prototype-integration-credential",
  failedPinAttempts: 0,
  lockedUntil: null,
};

const customer: Customer = {
  id: "customer-purchase-integration",
  accountId: customerAccount.id,
  walletId: "wallet-customer-purchase-integration",
  publicCode: "cus_PURCHASEINT",
  onboardingCompletedAt: occurredAt,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const vendor: Vendor = {
  id: "vendor-purchase-integration",
  accountId: vendorAccount.id,
  walletId: "wallet-vendor-purchase-integration",
  publicCode: "vnd_PURCHASEINT",
  displayName: "Integration Rice Stall",
  logo: null,
  banner: null,
  description: "Fictional purchase integration vendor.",
  stallLocation: "Integration Hall",
  operatingStatus: "open",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customerWallet: Wallet = {
  id: customer.walletId,
  ownerAccountId: customerAccount.id,
  ownerType: "customer",
  status: "active",
  createdAt: occurredAt,
};

const vendorWallet: Wallet = {
  id: vendor.walletId,
  ownerAccountId: vendorAccount.id,
  ownerType: "vendor",
  status: "active",
  createdAt: occurredAt,
};

const product: Product = {
  id: "product-purchase-integration",
  vendorId: vendor.id,
  name: "Integration Rice Bowl",
  description: "Fictional integration product.",
  image: null,
  tokenPrice: 9,
  category: "Meals",
  isAvailable: true,
  isSoldOut: false,
  isArchived: false,
  displayOrder: 0,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const openingCredit: LedgerEntry = {
  id: "ledger-opening-purchase-integration",
  walletId: customerWallet.id,
  transactionGroupId: "transaction-opening-purchase-integration",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 50,
  actorAccountId: "account-staff-purchase-integration",
  relatedCustomerId: customer.id,
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: "evidence-opening-purchase-integration",
  reference: "ISS-PURCHASE-INTEGRATION",
  description: "Integration-test opening credit.",
  occurredAt,
  idempotencyKey: "integration:opening:customer-credit",
  metadata: { source: "integration_test" },
  reversesLedgerEntryId: null,
};

function createVendorLedgerEntry(
  overrides: Readonly<
    Pick<
      LedgerEntry,
      | "direction"
      | "id"
      | "idempotencyKey"
      | "tokenAmount"
      | "transactionGroupId"
    >
  >,
): LedgerEntry {
  return {
    id: overrides.id,
    walletId: vendorWallet.id,
    transactionGroupId: overrides.transactionGroupId,
    entryType: "administrative_adjustment",
    direction: overrides.direction,
    tokenAmount: overrides.tokenAmount,
    actorAccountId: "account-administrator-purchase-integration",
    relatedCustomerId: null,
    relatedVendorId: vendor.id,
    relatedOrderId: null,
    relatedEvidenceId: null,
    reference: "ADJ-PURCHASE-INTEGRATION",
    description: "Integration-test vendor wallet setup.",
    occurredAt,
    idempotencyKey: overrides.idempotencyKey,
    metadata: { source: "integration_test" },
    reversesLedgerEntryId: null,
  };
}

const command = {
  actorAccountId: customerAccount.id,
  customerId: customer.id,
  vendorId: vendor.id,
  items: [{ productId: product.id, quantity: 3 }],
  idempotencyKey: "integration:purchase:001",
} as const;

let databaseSequence = 0;
let databaseName = "";
let repositories: LocalRepositories;

function createPurchaseTransactionRunner(
  failAuditAppend = false,
): RepositoryTransactionRunner<PurchaseTransactionRepositories> {
  return {
    run<Result>(
      work: (
        transactionRepositories: PurchaseTransactionRepositories,
      ) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction(
        (transactionRepositories) =>
          work({
            accounts: transactionRepositories.accounts,
            auditLogs: failAuditAppend
              ? {
                  append: async () => {
                    throw new Error("simulated purchase audit failure");
                  },
                }
              : transactionRepositories.auditLogs,
            customers: transactionRepositories.customers,
            ledgerEntries: transactionRepositories.ledgerEntries,
            orders: transactionRepositories.orders,
            products: transactionRepositories.products,
            vendors: transactionRepositories.vendors,
            wallets: transactionRepositories.wallets,
          }),
        { databaseName },
      );
    },
  };
}

function createPurchaseService(
  transactionRunner: RepositoryTransactionRunner<PurchaseTransactionRepositories>,
  options: {
    readonly uniqueTransactionIdentities?: boolean;
  } = {},
): PurchaseService {
  let idSequence = 0;
  let transactionSequence = 0;
  const dependencies: PurchaseServiceDependencies = {
    clock: {
      now: () => occurredAt,
    },
    idProvider: {
      generateId: (recordType) =>
        `${recordType}-purchase-integration-${++idSequence}`,
    },
    referenceProvider: {
      generateReference: () =>
        options.uniqueTransactionIdentities === true
          ? `ORD-PURCHASE-INTEGRATION-${++transactionSequence}`
          : "ORD-PURCHASE-INTEGRATION",
    },
    transactionGroupIdProvider: {
      generateTransactionGroupId: () =>
        options.uniqueTransactionIdentities === true
          ? `transaction-purchase-integration-${transactionSequence}`
          : "transaction-purchase-integration",
    },
    transactionRunner,
  };

  return new PurchaseService(dependencies);
}

async function seedPurchaseScenario(): Promise<void> {
  await repositories.accounts.create(customerAccount, customerCredential);
  await repositories.accounts.create(vendorAccount, vendorCredential);
  await repositories.wallets.create(customerWallet);
  await repositories.wallets.create(vendorWallet);
  await repositories.customers.create(customer);
  await repositories.vendors.create(vendor);
  await repositories.products.create(product);
  await repositories.ledgerEntries.append(openingCredit);
}

beforeEach(async () => {
  databaseSequence += 1;
  databaseName = `tokenly-purchase-service-${databaseSequence}`;
  repositories = await createLocalRepositories({ databaseName });
  await seedPurchaseScenario();
});

afterEach(async () => {
  await repositories.close();
  await deleteDB(databaseName);
});

describe("PurchaseService IndexedDB transaction", () => {
  it("atomically conserves value across a completed order and its audit record", async () => {
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize = vi.fn<PurchaseAuthorizationCallback>(
      async () => undefined,
    );

    const receipt = await service.completePurchase(command, authorize);

    const storedOrder = await repositories.orders.getById(receipt.orderId);
    const groupEntries =
      await repositories.ledgerEntries.findByTransactionGroupId(
        receipt.transactionGroupId,
      );
    const auditLogs = await repositories.auditLogs.findByTransactionGroupId(
      receipt.transactionGroupId,
    );
    const customerEntries = await repositories.ledgerEntries.findByWalletId(
      customerWallet.id,
    );
    const vendorEntries = await repositories.ledgerEntries.findByWalletId(
      vendorWallet.id,
    );

    expect(authorize).toHaveBeenCalledOnce();
    expect(receipt).toMatchObject({
      reference: "ORD-PURCHASE-INTEGRATION",
      tokenTotal: 27,
      vendorDisplayName: vendor.displayName,
    });
    expect(storedOrder).toMatchObject({
      status: "completed",
      tokenTotal: 27,
      items: [
        expect.objectContaining({
          unitTokenPrice: product.tokenPrice,
          quantity: 3,
          lineTokenTotal: 27,
        }),
      ],
    });
    expect(groupEntries).toHaveLength(2);
    expect(groupEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: customerWallet.id,
          direction: "debit",
          tokenAmount: 27,
          relatedOrderId: receipt.orderId,
          idempotencyKey: createOperationLedgerIdempotencyKey(
            command.idempotencyKey,
          ),
        }),
        expect.objectContaining({
          walletId: vendorWallet.id,
          direction: "credit",
          tokenAmount: 27,
          relatedOrderId: receipt.orderId,
          idempotencyKey: createScopedLedgerIdempotencyKey(
            command.idempotencyKey,
            "vendor-credit",
          ),
        }),
      ]),
    );
    expect(
      groupEntries.reduce(
        (net, entry) =>
          net + (entry.direction === "credit" ? 1 : -1) * entry.tokenAmount,
        0,
      ),
    ).toBe(0);
    expect(calculateWalletBalance(customerEntries)).toBe(23);
    expect(calculateWalletBalance(vendorEntries)).toBe(27);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      eventType: "purchase_completed",
      targetId: receipt.orderId,
      transactionGroupId: receipt.transactionGroupId,
    });

    const auditLog = auditLogs[0];

    if (auditLog !== undefined) {
      expect(() => assertSafeAuditMetadata(auditLog.metadata)).not.toThrow();
    }
  });

  it("rolls back the order and both ledger entries when audit persistence fails", async () => {
    const service = createPurchaseService(
      createPurchaseTransactionRunner(true),
    );
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    await expect(service.completePurchase(command, authorize)).rejects.toThrow(
      "simulated purchase audit failure",
    );

    expect(await repositories.orders.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByWalletId(customerWallet.id),
    ).toEqual([openingCredit]);
    expect(
      await repositories.ledgerEntries.findByWalletId(vendorWallet.id),
    ).toEqual([]);
  });

  it("rejects a negative current vendor balance without committing purchase records", async () => {
    const vendorDebit = createVendorLedgerEntry({
      id: "ledger-vendor-negative-purchase-integration",
      transactionGroupId: "transaction-vendor-negative-purchase-integration",
      direction: "debit",
      tokenAmount: 1,
      idempotencyKey: "integration:vendor:negative",
    });
    await repositories.ledgerEntries.append(vendorDebit);
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    try {
      await service.completePurchase(command, authorize);
      throw new Error("Expected invalid vendor wallet rejection.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PurchaseServiceError);

      if (error instanceof PurchaseServiceError) {
        expect(error.code).toBe("PURCHASE_VENDOR_WALLET_INVALID");
      }
    }

    expect(await repositories.orders.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByWalletId(vendorWallet.id),
    ).toEqual([vendorDebit]);
  });

  it("rejects a vendor credit that would overflow MAX_SAFE_INTEGER without committing", async () => {
    const maximumVendorCredit = createVendorLedgerEntry({
      id: "ledger-vendor-maximum-purchase-integration",
      transactionGroupId: "transaction-vendor-maximum-purchase-integration",
      direction: "credit",
      tokenAmount: Number.MAX_SAFE_INTEGER,
      idempotencyKey: "integration:vendor:maximum",
    });
    await repositories.ledgerEntries.append(maximumVendorCredit);
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    try {
      await service.completePurchase(command, authorize);
      throw new Error("Expected vendor wallet overflow rejection.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PurchaseServiceError);

      if (error instanceof PurchaseServiceError) {
        expect(error.code).toBe("PURCHASE_VENDOR_BALANCE_OVERFLOW");
      }
    }

    expect(await repositories.orders.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByWalletId(vendorWallet.id),
    ).toEqual([maximumVendorCredit]);
  });

  it("rejects a generated transaction-group collision without committing", async () => {
    const collidingEntry = createVendorLedgerEntry({
      id: "ledger-group-collision-purchase-integration",
      transactionGroupId: "transaction-purchase-integration",
      direction: "credit",
      tokenAmount: 1,
      idempotencyKey: "integration:vendor:group-collision",
    });
    await repositories.ledgerEntries.append(collidingEntry);
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    try {
      await service.completePurchase(command, authorize);
      throw new Error("Expected transaction-group collision rejection.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PurchaseServiceError);

      if (error instanceof PurchaseServiceError) {
        expect(error.code).toBe("PURCHASE_TRANSACTION_GROUP_COLLISION");
      }
    }

    expect(await repositories.orders.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(
      await repositories.ledgerEntries.findByTransactionGroupId(
        "transaction-purchase-integration",
      ),
    ).toEqual([collidingEntry]);
  });

  it("rejects a duplicate operation key without a second commit", async () => {
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    await service.completePurchase(command, authorize);

    try {
      await service.completePurchase(command, authorize);
      throw new Error("Expected duplicate purchase rejection.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PurchaseServiceError);

      if (error instanceof PurchaseServiceError) {
        expect(error.code).toBe("PURCHASE_DUPLICATE_SUBMISSION");
      }
    }

    expect(await repositories.orders.list()).toHaveLength(1);
    expect(
      await repositories.ledgerEntries.findByTransactionGroupId(
        "transaction-purchase-integration",
      ),
    ).toHaveLength(2);
    expect(
      await repositories.auditLogs.findByTransactionGroupId(
        "transaction-purchase-integration",
      ),
    ).toHaveLength(1);
  });

  it("serializes concurrent duplicate submissions to exactly one commit", async () => {
    const service = createPurchaseService(createPurchaseTransactionRunner());
    const authorize: PurchaseAuthorizationCallback = async () => undefined;

    const results = await Promise.allSettled([
      service.completePurchase(command, authorize),
      service.completePurchase(command, authorize),
    ]);
    const fulfilledResults = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<PurchaseService["completePurchase"]>>
      > => result.status === "fulfilled",
    );
    const rejectedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]?.reason).toBeInstanceOf(PurchaseServiceError);

    const duplicateError: unknown = rejectedResults[0]?.reason;

    if (duplicateError instanceof PurchaseServiceError) {
      expect(duplicateError.code).toBe("PURCHASE_DUPLICATE_SUBMISSION");
    }

    const storedOrders = await repositories.orders.list();
    expect(storedOrders).toHaveLength(1);
    const storedOrder = storedOrders[0];

    if (storedOrder === undefined) {
      throw new Error("Expected one committed purchase order.");
    }

    const purchaseEntries = (
      await repositories.ledgerEntries.list({
        relatedOrderId: storedOrder.id,
      })
    ).filter(
      (entry) =>
        entry.entryType === "customer_purchase" ||
        entry.entryType === "vendor_receipt",
    );

    expect(purchaseEntries).toHaveLength(2);
    expect(await repositories.auditLogs.list()).toHaveLength(1);
  });

  it("serializes distinct concurrent purchases so their combined spend cannot overdraw", async () => {
    const service = createPurchaseService(createPurchaseTransactionRunner(), {
      uniqueTransactionIdentities: true,
    });
    const authorize: PurchaseAuthorizationCallback = async () => undefined;
    const firstCommand = {
      ...command,
      idempotencyKey: "integration:purchase:overspend:first",
    };
    const secondCommand = {
      ...command,
      idempotencyKey: "integration:purchase:overspend:second",
    };

    const results = await Promise.allSettled([
      service.completePurchase(firstCommand, authorize),
      service.completePurchase(secondCommand, authorize),
    ]);
    const fulfilledResults = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<PurchaseService["completePurchase"]>>
      > => result.status === "fulfilled",
    );
    const rejectedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]?.reason).toBeInstanceOf(PurchaseServiceError);

    const insufficientBalanceError: unknown = rejectedResults[0]?.reason;

    if (insufficientBalanceError instanceof PurchaseServiceError) {
      expect(insufficientBalanceError.code).toBe(
        "PURCHASE_INSUFFICIENT_BALANCE",
      );
    }

    const storedOrders = await repositories.orders.list();
    const customerEntries = await repositories.ledgerEntries.findByWalletId(
      customerWallet.id,
    );
    const vendorEntries = await repositories.ledgerEntries.findByWalletId(
      vendorWallet.id,
    );
    const purchaseEntries = (await repositories.ledgerEntries.list()).filter(
      (entry) =>
        entry.entryType === "customer_purchase" ||
        entry.entryType === "vendor_receipt",
    );
    const finalCustomerBalance = calculateWalletBalance(customerEntries);

    expect(storedOrders).toHaveLength(1);
    expect(purchaseEntries).toHaveLength(2);
    expect(await repositories.auditLogs.list()).toHaveLength(1);
    expect(finalCustomerBalance).toBe(23);
    expect(finalCustomerBalance).toBeGreaterThanOrEqual(0);
    expect(calculateWalletBalance(vendorEntries)).toBe(27);
  });
});
