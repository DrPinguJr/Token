import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type { Product } from "@/modules/products";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  type LedgerEntry,
} from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import type { Wallet } from "@/modules/wallets";

import type { Order } from "./order";
import { purchaseCommandSchema } from "./purchase-command-schema";
import {
  PurchaseService,
  type PurchaseAuthorizationCallback,
  type PurchaseServiceDependencies,
  type PurchaseTransactionRepositories,
} from "./purchase-service";
import {
  PurchaseServiceError,
  type PurchaseServiceErrorCode,
} from "./purchase-service-error";

const occurredAt = "2026-07-27T02:00:00.000Z";

const customerAccount: Account = {
  id: "account-customer-unit",
  mobileNumber: "91111111",
  displayName: "Unit Customer",
  role: "customer",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const vendorAccount: Account = {
  id: "account-vendor-unit",
  mobileNumber: "92222222",
  displayName: "Unit Vendor Account",
  role: "vendor",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customer: Customer = {
  id: "customer-unit",
  accountId: customerAccount.id,
  walletId: "wallet-customer-unit",
  publicCode: "cus_UNIT1234",
  onboardingCompletedAt: occurredAt,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const vendor: Vendor = {
  id: "vendor-unit",
  accountId: vendorAccount.id,
  walletId: "wallet-vendor-unit",
  publicCode: "vnd_UNIT1234",
  displayName: "Unit Noodle Stall",
  logo: null,
  banner: null,
  description: "Fictional unit-test vendor.",
  stallLocation: "Unit Hall",
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
  id: "product-unit",
  vendorId: vendor.id,
  name: "Authoritative Noodles",
  description: "Fictional unit-test product.",
  image: null,
  tokenPrice: 7,
  category: "Meals",
  isAvailable: true,
  isSoldOut: false,
  isArchived: false,
  displayOrder: 2,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const openingCredit: LedgerEntry = {
  id: "ledger-opening-unit",
  walletId: customerWallet.id,
  transactionGroupId: "transaction-opening-unit",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 20,
  actorAccountId: "account-staff-unit",
  relatedCustomerId: customer.id,
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: "evidence-opening-unit",
  reference: "ISS-UNIT-OPENING",
  description: "Unit-test opening credit.",
  occurredAt,
  idempotencyKey: "unit:opening:customer-credit",
  metadata: { source: "unit_test" },
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
    actorAccountId: "account-administrator-unit",
    relatedCustomerId: null,
    relatedVendorId: vendor.id,
    relatedOrderId: null,
    relatedEvidenceId: null,
    reference: "ADJ-VENDOR-UNIT",
    description: "Unit-test vendor wallet setup.",
    occurredAt,
    idempotencyKey: overrides.idempotencyKey,
    metadata: { source: "unit_test" },
    reversesLedgerEntryId: null,
  };
}

const validCommand = {
  actorAccountId: customerAccount.id,
  customerId: customer.id,
  vendorId: vendor.id,
  items: [{ productId: product.id, quantity: 2 }],
  idempotencyKey: "unit:purchase:001",
} as const;

interface PurchaseHarness {
  readonly auditLogs: AuditLog[];
  readonly authorize: ReturnType<typeof vi.fn<PurchaseAuthorizationCallback>>;
  readonly ledgerEntries: LedgerEntry[];
  readonly orders: Order[];
  readonly products: Map<string, Product>;
  readonly service: PurchaseService;
  readonly transactionRunCount: () => number;
}

function createPurchaseHarness(options?: {
  readonly openingTokenAmount?: number;
  readonly productOverride?: Partial<Product>;
  readonly vendorLedgerEntries?: readonly LedgerEntry[];
}): PurchaseHarness {
  const accounts = new Map<string, Account>([
    [customerAccount.id, customerAccount],
    [vendorAccount.id, vendorAccount],
  ]);
  const customers = new Map<string, Customer>([[customer.id, customer]]);
  const vendors = new Map<string, Vendor>([[vendor.id, vendor]]);
  const wallets = new Map<string, Wallet>([
    [customerWallet.id, customerWallet],
    [vendorWallet.id, vendorWallet],
  ]);
  const products = new Map<string, Product>([
    [
      product.id,
      {
        ...product,
        ...options?.productOverride,
      },
    ],
  ]);
  const orders: Order[] = [];
  const auditLogs: AuditLog[] = [];
  const ledgerEntries: LedgerEntry[] = [
    {
      ...openingCredit,
      tokenAmount: options?.openingTokenAmount ?? openingCredit.tokenAmount,
    },
    ...(options?.vendorLedgerEntries ?? []),
  ];

  const repositories: PurchaseTransactionRepositories = {
    accounts: {
      getById: async (id) => accounts.get(id) ?? null,
    },
    auditLogs: {
      append: async (entry) => {
        auditLogs.push(entry);
      },
    },
    customers: {
      getById: async (id) => customers.get(id) ?? null,
    },
    ledgerEntries: {
      append: async (entry) => {
        ledgerEntries.push(entry);
      },
      findByWalletId: async (walletId) =>
        ledgerEntries.filter((entry) => entry.walletId === walletId),
      findByTransactionGroupId: async (transactionGroupId) =>
        ledgerEntries.filter(
          (entry) => entry.transactionGroupId === transactionGroupId,
        ),
      getByIdempotencyKey: async (idempotencyKey) =>
        ledgerEntries.find(
          (entry) => entry.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    orders: {
      create: async (order) => {
        orders.push(order);
      },
      getByIdempotencyKey: async (idempotencyKey) =>
        orders.find((order) => order.idempotencyKey === idempotencyKey) ?? null,
    },
    products: {
      getById: async (id) => products.get(id) ?? null,
    },
    vendors: {
      getById: async (id) => vendors.get(id) ?? null,
    },
    wallets: {
      getById: async (id) => wallets.get(id) ?? null,
    },
  };

  let idSequence = 0;
  let transactionRuns = 0;
  const dependencies: PurchaseServiceDependencies = {
    clock: {
      now: () => occurredAt,
    },
    idProvider: {
      generateId: (recordType) => `${recordType}-unit-${++idSequence}`,
    },
    referenceProvider: {
      generateReference: () => "ORD-UNIT-001",
    },
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => "transaction-purchase-unit",
    },
    transactionRunner: {
      async run<Result>(
        work: (
          transactionRepositories: PurchaseTransactionRepositories,
        ) => Promise<Result>,
      ): Promise<Result> {
        transactionRuns += 1;
        return work(repositories);
      },
    },
  };
  const authorize = vi.fn<PurchaseAuthorizationCallback>(async () => undefined);

  return {
    auditLogs,
    authorize,
    ledgerEntries,
    orders,
    products,
    service: new PurchaseService(dependencies),
    transactionRunCount: () => transactionRuns,
  };
}

async function expectPurchaseError(
  promise: Promise<unknown>,
  code: PurchaseServiceErrorCode,
): Promise<void> {
  try {
    await promise;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(PurchaseServiceError);

    if (error instanceof PurchaseServiceError) {
      expect(error.code).toBe(code);
    }

    return;
  }

  throw new Error(`Expected purchase service error ${code}.`);
}

describe("purchaseCommandSchema", () => {
  it("rejects empty baskets, invalid quantities, duplicate products, and client totals", () => {
    expect(
      purchaseCommandSchema.safeParse({ ...validCommand, items: [] }).success,
    ).toBe(false);
    expect(
      purchaseCommandSchema.safeParse({
        ...validCommand,
        items: [{ productId: product.id, quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      purchaseCommandSchema.safeParse({
        ...validCommand,
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      purchaseCommandSchema.safeParse({
        ...validCommand,
        clientTokenTotal: 1,
      }).success,
    ).toBe(false);
  });
});

describe("PurchaseService", () => {
  it("authorizes before opening the transaction and snapshots repository prices", async () => {
    const harness = createPurchaseHarness();

    harness.authorize.mockImplementationOnce(async () => {
      expect(harness.transactionRunCount()).toBe(0);
    });

    const receipt = await harness.service.completePurchase(
      validCommand,
      harness.authorize,
    );

    expect(receipt).toMatchObject({
      reference: "ORD-UNIT-001",
      vendorDisplayName: vendor.displayName,
      tokenTotal: 14,
      completedAt: occurredAt,
    });
    expect(receipt.items).toEqual([
      expect.objectContaining({
        productId: product.id,
        unitTokenPrice: 7,
        quantity: 2,
        lineTokenTotal: 14,
      }),
    ]);
    expect(harness.orders).toHaveLength(1);
    expect(harness.orders[0]).toMatchObject({
      status: "completed",
      tokenTotal: 14,
    });
    expect(Object.isFrozen(harness.orders[0])).toBe(true);
    expect(harness.ledgerEntries.slice(1)).toEqual([
      expect.objectContaining({
        direction: "debit",
        tokenAmount: 14,
        idempotencyKey: createOperationLedgerIdempotencyKey(
          validCommand.idempotencyKey,
        ),
      }),
      expect.objectContaining({
        direction: "credit",
        tokenAmount: 14,
        idempotencyKey: createScopedLedgerIdempotencyKey(
          validCommand.idempotencyKey,
          "vendor-credit",
        ),
      }),
    ]);
    expect(harness.auditLogs).toEqual([
      expect.objectContaining({
        eventType: "purchase_completed",
        metadata: {
          itemCount: 2,
          productCount: 1,
          source: "purchase_service",
          tokenAmount: 14,
        },
      }),
    ]);
  });

  it("rejects an authoritative total above the ledger-derived balance without writing", async () => {
    const harness = createPurchaseHarness({ openingTokenAmount: 10 });

    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_INSUFFICIENT_BALANCE",
    );

    expect(harness.orders).toEqual([]);
    expect(harness.ledgerEntries).toEqual([
      expect.objectContaining({ id: openingCredit.id }),
    ]);
    expect(harness.auditLogs).toEqual([]);
  });

  it("rejects a vendor wallet whose current ledger-derived balance is negative", async () => {
    const vendorDebit = createVendorLedgerEntry({
      id: "ledger-vendor-negative-unit",
      transactionGroupId: "transaction-vendor-negative-unit",
      direction: "debit",
      tokenAmount: 1,
      idempotencyKey: "unit:vendor:negative",
    });
    const harness = createPurchaseHarness({
      vendorLedgerEntries: [vendorDebit],
    });

    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_VENDOR_WALLET_INVALID",
    );

    expect(harness.orders).toEqual([]);
    expect(harness.ledgerEntries).toEqual([
      expect.objectContaining({ id: openingCredit.id }),
      vendorDebit,
    ]);
    expect(harness.auditLogs).toEqual([]);
  });

  it("rejects a vendor credit that would exceed the safe-integer balance range", async () => {
    const maximumVendorCredit = createVendorLedgerEntry({
      id: "ledger-vendor-maximum-unit",
      transactionGroupId: "transaction-vendor-maximum-unit",
      direction: "credit",
      tokenAmount: Number.MAX_SAFE_INTEGER,
      idempotencyKey: "unit:vendor:maximum",
    });
    const harness = createPurchaseHarness({
      vendorLedgerEntries: [maximumVendorCredit],
    });

    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_VENDOR_BALANCE_OVERFLOW",
    );

    expect(harness.orders).toEqual([]);
    expect(harness.ledgerEntries).toEqual([
      expect.objectContaining({ id: openingCredit.id }),
      maximumVendorCredit,
    ]);
    expect(harness.auditLogs).toEqual([]);
  });

  it("rejects a generated transaction group that already has ledger entries", async () => {
    const collidingEntry = createVendorLedgerEntry({
      id: "ledger-group-collision-unit",
      transactionGroupId: "transaction-purchase-unit",
      direction: "credit",
      tokenAmount: 1,
      idempotencyKey: "unit:vendor:group-collision",
    });
    const harness = createPurchaseHarness({
      vendorLedgerEntries: [collidingEntry],
    });

    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_TRANSACTION_GROUP_COLLISION",
    );

    expect(harness.orders).toEqual([]);
    expect(harness.ledgerEntries).toEqual([
      expect.objectContaining({ id: openingCredit.id }),
      collidingEntry,
    ]);
    expect(harness.auditLogs).toEqual([]);
  });

  it.each([
    ["not available", { isAvailable: false }],
    ["sold out", { isSoldOut: true }],
    ["archived", { isArchived: true }],
    ["owned by another vendor", { vendorId: "vendor-other" }],
  ] satisfies ReadonlyArray<readonly [string, Partial<Product>]>)(
    "rejects a product that is %s",
    async (_label, productOverride) => {
      const harness = createPurchaseHarness({ productOverride });

      await expectPurchaseError(
        harness.service.completePurchase(validCommand, harness.authorize),
        "PURCHASE_PRODUCT_UNAVAILABLE",
      );

      expect(harness.orders).toEqual([]);
      expect(harness.auditLogs).toEqual([]);
    },
  );

  it("rejects a missing product", async () => {
    const harness = createPurchaseHarness();
    harness.products.delete(product.id);

    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_PRODUCT_UNAVAILABLE",
    );

    expect(harness.orders).toEqual([]);
  });

  it("rejects a repeated operation key without duplicating value", async () => {
    const harness = createPurchaseHarness();

    await harness.service.completePurchase(validCommand, harness.authorize);
    await expectPurchaseError(
      harness.service.completePurchase(validCommand, harness.authorize),
      "PURCHASE_DUPLICATE_SUBMISSION",
    );

    expect(harness.orders).toHaveLength(1);
    expect(harness.ledgerEntries).toHaveLength(3);
    expect(harness.auditLogs).toHaveLength(1);
  });

  it("does not open a transaction when the authorization hook rejects", async () => {
    const harness = createPurchaseHarness();
    const authorizationError = new Error("generic authorization failure");
    const rejectAuthorization: PurchaseAuthorizationCallback = async () => {
      throw authorizationError;
    };

    await expect(
      harness.service.completePurchase(validCommand, rejectAuthorization),
    ).rejects.toBe(authorizationError);
    expect(harness.transactionRunCount()).toBe(0);
    expect(harness.orders).toEqual([]);
  });
});
