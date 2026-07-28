import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type { Order } from "@/modules/orders";
import {
  RefundService,
  type Refund,
  type RefundTransactionRepositories,
} from "@/modules/refunds";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  type LedgerEntry,
  type TransactionIdProvider,
} from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import type { Wallet } from "@/modules/wallets";

const occurredAt = "2026-07-25T12:00:00.000Z";

const vendorAccount: Account = {
  id: "account-vendor-001",
  mobileNumber: "90000002",
  displayName: "Test Vendor Account",
  role: "vendor",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const customerAccount: Account = {
  id: "account-customer-001",
  mobileNumber: "90000001",
  displayName: "Test Customer Account",
  role: "customer",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const vendor: Vendor = {
  id: "vendor-001",
  accountId: vendorAccount.id,
  walletId: "wallet-vendor-001",
  publicCode: "vnd_TEST001",
  displayName: "Test Vendor",
  logo: null,
  banner: null,
  description: "Fictional refund service vendor.",
  stallLocation: "Test Hall",
  operatingStatus: "open",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const customerWallet: Wallet = {
  id: "wallet-customer-001",
  ownerAccountId: customerAccount.id,
  ownerType: "customer",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
};

const customer: Customer = {
  id: "customer-001",
  accountId: customerWallet.ownerAccountId,
  walletId: customerWallet.id,
  publicCode: "cus_TEST001",
  onboardingCompletedAt: "2026-07-25T00:30:00.000Z",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:30:00.000Z",
};

const vendorWallet: Wallet = {
  id: vendor.walletId,
  ownerAccountId: vendor.accountId,
  ownerType: "vendor",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
};

const order: Order = {
  id: "order-001",
  reference: "ORD-001",
  customerId: "customer-001",
  vendorId: vendor.id,
  customerWalletId: customerWallet.id,
  vendorWalletId: vendorWallet.id,
  status: "completed",
  items: [
    {
      productId: "product-001",
      productName: "Test Product",
      unitTokenPrice: 30,
      quantity: 1,
      lineTokenTotal: 30,
      displayOrder: 0,
    },
  ],
  tokenTotal: 30,
  transactionGroupId: "transaction-purchase-001",
  idempotencyKey: "test:purchase:001",
  completedAt: "2026-07-25T10:00:00.000Z",
};

const customerPurchaseDebit: LedgerEntry = {
  id: "ledger-purchase-customer-001",
  walletId: customerWallet.id,
  transactionGroupId: order.transactionGroupId,
  entryType: "customer_purchase",
  direction: "debit",
  tokenAmount: order.tokenTotal,
  actorAccountId: customerWallet.ownerAccountId,
  relatedCustomerId: order.customerId,
  relatedVendorId: order.vendorId,
  relatedOrderId: order.id,
  relatedEvidenceId: null,
  reference: order.reference,
  description: "Customer wallet debit for completed order.",
  occurredAt: order.completedAt,
  idempotencyKey: createOperationLedgerIdempotencyKey(order.idempotencyKey),
  metadata: {
    pairedLedgerEntryId: "ledger-purchase-vendor-001",
    source: "purchase_service",
  },
  reversesLedgerEntryId: null,
};

const vendorPurchaseCredit: LedgerEntry = {
  ...customerPurchaseDebit,
  id: "ledger-purchase-vendor-001",
  walletId: vendorWallet.id,
  entryType: "vendor_receipt",
  direction: "credit",
  idempotencyKey: createScopedLedgerIdempotencyKey(
    order.idempotencyKey,
    "vendor-credit",
  ),
  description: "Vendor wallet credit for completed order.",
  metadata: {
    pairedLedgerEntryId: customerPurchaseDebit.id,
    source: "purchase_service",
  },
};

const customerOpeningCredit: LedgerEntry = {
  id: "ledger-customer-opening-credit",
  walletId: customerWallet.id,
  transactionGroupId: "transaction-customer-opening-credit",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 40,
  actorAccountId: "account-staff-001",
  relatedCustomerId: customer.id,
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: "evidence-customer-opening-credit",
  reference: "ISS-OPENING",
  description: "Opening customer credit for refund service tests.",
  occurredAt: "2026-07-25T09:00:00.000Z",
  idempotencyKey: createOperationLedgerIdempotencyKey(
    "test:refund:customer-opening-credit",
  ),
  metadata: {},
  reversesLedgerEntryId: null,
};

interface RefundMemoryState {
  readonly refunds: Refund[];
  readonly ledgerEntries: LedgerEntry[];
  readonly auditLogs: AuditLog[];
}

function createIdProvider(): TransactionIdProvider {
  const counts = new Map<string, number>();

  return {
    generateId: (recordType) => {
      const count = (counts.get(recordType) ?? 0) + 1;
      counts.set(recordType, count);
      return `${recordType}-generated-${count}`;
    },
  };
}

function createRefundHarness(options?: {
  readonly vendorAccountOverride?: Account;
  readonly customerAccountOverride?: Account | null;
  readonly customerOverride?: Customer | null;
  readonly vendorOverride?: Vendor | null;
  readonly customerOpeningEntries?: readonly LedgerEntry[];
  readonly vendorOpeningEntries?: readonly LedgerEntry[];
}) {
  const state: RefundMemoryState = {
    refunds: [],
    ledgerEntries: [
      ...(options?.customerOpeningEntries ?? [customerOpeningCredit]),
      customerPurchaseDebit,
      ...(options?.vendorOpeningEntries ?? [vendorPurchaseCredit]),
    ],
    auditLogs: [],
  };
  const actor = options?.vendorAccountOverride ?? vendorAccount;
  const ownedVendor =
    options !== undefined && "vendorOverride" in options
      ? options.vendorOverride
      : vendor;
  const orderCustomer =
    options !== undefined && "customerOverride" in options
      ? options.customerOverride
      : customer;
  const orderCustomerAccount =
    options !== undefined && "customerAccountOverride" in options
      ? options.customerAccountOverride
      : customerAccount;
  const repositories = {
    accounts: {
      getById: async (id: string) =>
        id === actor.id
          ? actor
          : orderCustomerAccount?.id === id
            ? orderCustomerAccount
            : null,
    },
    auditLogs: {
      append: async (auditLog: AuditLog) => {
        state.auditLogs.push(auditLog);
      },
    },
    customers: {
      getById: async (id: string) =>
        orderCustomer?.id === id ? orderCustomer : null,
    },
    ledgerEntries: {
      append: async (entry: LedgerEntry) => {
        state.ledgerEntries.push(entry);
      },
      findByRelatedOrderId: async (orderId: string) =>
        state.ledgerEntries.filter((entry) => entry.relatedOrderId === orderId),
      findByTransactionGroupId: async (transactionGroupId: string) =>
        state.ledgerEntries.filter(
          (entry) => entry.transactionGroupId === transactionGroupId,
        ),
      findByWalletId: async (walletId: string) =>
        state.ledgerEntries.filter((entry) => entry.walletId === walletId),
      getByIdempotencyKey: async (idempotencyKey: string) =>
        state.ledgerEntries.find(
          (entry) => entry.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    orders: {
      getById: async (id: string) => (id === order.id ? order : null),
    },
    refunds: {
      create: async (refund: Refund) => {
        state.refunds.push(refund);
      },
      findByOrderId: async (orderId: string) =>
        state.refunds.filter((refund) => refund.orderId === orderId),
      getByIdempotencyKey: async (idempotencyKey: string) =>
        state.refunds.find(
          (refund) => refund.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    vendors: {
      getByAccountId: async (accountId: string) =>
        ownedVendor?.accountId === accountId ? ownedVendor : null,
    },
    wallets: {
      getById: async (id: string) =>
        [customerWallet, vendorWallet].find((wallet) => wallet.id === id) ??
        null,
    },
  } satisfies RefundTransactionRepositories;
  const authorize = vi.fn(async () => undefined);
  let runCallCount = 0;
  let referenceCount = 0;
  let transactionGroupCount = 0;
  const transactionRunner = {
    run: async <Result>(
      work: (value: RefundTransactionRepositories) => Promise<Result>,
    ): Promise<Result> => {
      runCallCount += 1;
      return work(repositories);
    },
  };
  const service = new RefundService({
    authorize,
    clock: { now: () => occurredAt },
    idProvider: createIdProvider(),
    referenceProvider: {
      generateReference: () => {
        referenceCount += 1;
        return `REF-GENERATED-${referenceCount}`;
      },
    },
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => {
        transactionGroupCount += 1;
        return `transaction-refund-generated-${transactionGroupCount}`;
      },
    },
    transactionRunner,
  });

  return {
    authorize,
    getRunCallCount: () => runCallCount,
    service,
    state,
  };
}

describe("RefundService", () => {
  it("creates partial and then full reversing refunds while preserving originals", async () => {
    const { service, state } = createRefundHarness();
    const originalCustomerEntry = state.ledgerEntries.find(
      ({ id }) => id === customerPurchaseDebit.id,
    );
    const originalVendorEntry = state.ledgerEntries.find(
      ({ id }) => id === vendorPurchaseCredit.id,
    );

    const partialReceipt = await service.createRefund({
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 10,
      reason: "One item was unavailable.",
      idempotencyKey: "test:refund:partial",
    });
    const fullReceipt = await service.createRefund({
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 20,
      reason: "The remainder of the order was cancelled.",
      idempotencyKey: "test:refund:full",
    });

    expect(partialReceipt.remainingRefundableTokenAmount).toBe(20);
    expect(partialReceipt.customerLedgerEntry).toMatchObject({
      direction: "credit",
      entryType: "customer_refund",
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:refund:partial",
      ),
      reversesLedgerEntryId: customerPurchaseDebit.id,
      tokenAmount: 10,
    });
    expect(partialReceipt.vendorLedgerEntry).toMatchObject({
      direction: "debit",
      entryType: "vendor_refund",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "test:refund:partial",
        "vendor-debit",
      ),
      reversesLedgerEntryId: vendorPurchaseCredit.id,
      tokenAmount: 10,
    });
    expect(fullReceipt.remainingRefundableTokenAmount).toBe(0);
    expect(fullReceipt.auditLog.metadata).toMatchObject({
      refundScope: "full",
    });
    expect(state.refunds).toHaveLength(2);
    expect(
      state.ledgerEntries.find(({ id }) => id === customerPurchaseDebit.id),
    ).toBe(originalCustomerEntry);
    expect(
      state.ledgerEntries.find(({ id }) => id === vendorPurchaseCredit.id),
    ).toBe(originalVendorEntry);
    expect(state.ledgerEntries).toHaveLength(7);
    expect(state.auditLogs).toHaveLength(2);
  });

  it("rejects an over-refund without appending any record", async () => {
    const { service, state } = createRefundHarness();

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 31,
        reason: "Invalid excessive refund.",
        idempotencyKey: "test:refund:over",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDS_REMAINING",
    });

    expect(state.refunds).toEqual([]);
    expect(state.ledgerEntries).toEqual([
      customerOpeningCredit,
      customerPurchaseDebit,
      vendorPurchaseCredit,
    ]);
    expect(state.auditLogs).toEqual([]);
  });

  it("rejects a refund that would overdraw the vendor wallet", async () => {
    const vendorDebit: LedgerEntry = {
      ...vendorPurchaseCredit,
      id: "ledger-vendor-adjustment-debit",
      transactionGroupId: "transaction-adjustment-001",
      entryType: "administrative_adjustment",
      direction: "debit",
      tokenAmount: 25,
      relatedOrderId: null,
      reference: "ADJ-001",
      idempotencyKey: "test:adjustment:vendor-debit",
    };
    const { service, state } = createRefundHarness({
      vendorOpeningEntries: [vendorPurchaseCredit, vendorDebit],
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 10,
        reason: "Vendor cannot fund this refund.",
        idempotencyKey: "test:refund:overdraft",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_VENDOR_BALANCE_INSUFFICIENT",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  it("rejects duplicate idempotency keys", async () => {
    const { service, state } = createRefundHarness();
    const command = {
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 5,
      reason: "Duplicate submission test.",
      idempotencyKey: "test:refund:duplicate",
    };

    await service.createRefund(command);

    await expect(service.createRefund(command)).rejects.toMatchObject({
      code: "REFUND_DUPLICATE_IDEMPOTENCY_KEY",
    });
    expect(state.refunds).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("runs the injected authorization hook before opening a transaction", async () => {
    const { authorize, getRunCallCount, service } = createRefundHarness();
    authorize.mockRejectedValueOnce(new Error("PIN authorization failed."));

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Authorization ordering test.",
        idempotencyKey: "test:refund:authorization",
      }),
    ).rejects.toThrow("PIN authorization failed.");

    expect(authorize).toHaveBeenCalledOnce();
    expect(getRunCallCount()).toBe(0);
  });

  it("rejects a vendor actor who does not own the order", async () => {
    const otherVendor = {
      ...vendor,
      id: "vendor-002",
      accountId: "account-vendor-002",
      walletId: "wallet-vendor-002",
    };
    const otherVendorAccount = {
      ...vendorAccount,
      id: otherVendor.accountId,
      mobileNumber: "90000005",
    };
    const { service } = createRefundHarness({
      vendorAccountOverride: otherVendorAccount,
      vendorOverride: otherVendor,
    });

    await expect(
      service.createRefund({
        actorAccountId: otherVendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Ownership mismatch test.",
        idempotencyKey: "test:refund:ownership",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_ORDER_OWNERSHIP_MISMATCH",
    });
  });

  it("rejects corrupt customer and vendor wallet relationships", async () => {
    const customerMismatch = createRefundHarness({
      customerOverride: {
        ...customer,
        walletId: "wallet-customer-corrupt",
      },
    });
    const vendorMismatch = createRefundHarness({
      vendorOverride: {
        ...vendor,
        walletId: "wallet-vendor-corrupt",
      },
    });
    const command = {
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 5,
      reason: "Relationship integrity test.",
      idempotencyKey: "test:refund:relationships",
    };

    await expect(
      customerMismatch.service.createRefund(command),
    ).rejects.toMatchObject({
      code: "REFUND_ORDER_RELATIONSHIPS_INVALID",
    });
    await expect(
      vendorMismatch.service.createRefund(command),
    ).rejects.toMatchObject({
      code: "REFUND_ORDER_RELATIONSHIPS_INVALID",
    });

    expect(customerMismatch.state.refunds).toEqual([]);
    expect(vendorMismatch.state.refunds).toEqual([]);
  });

  it("rejects a corrupt original purchase ledger relationship", async () => {
    const corruptVendorCredit: LedgerEntry = {
      ...vendorPurchaseCredit,
      relatedVendorId: "vendor-corrupt",
    };
    const { service, state } = createRefundHarness({
      vendorOpeningEntries: [corruptVendorCredit],
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Original ledger relationship integrity test.",
        idempotencyKey: "test:refund:ledger-relationship",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_ORIGINAL_LEDGER_PAIR_INVALID",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  it("allows an owed refund to a disabled customer account with intact ownership", async () => {
    const { service } = createRefundHarness({
      customerAccountOverride: {
        ...customerAccount,
        status: "disabled",
      },
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Refund remains owed after login was disabled.",
        idempotencyKey: "test:refund:disabled-customer",
      }),
    ).resolves.toMatchObject({
      remainingRefundableTokenAmount: 25,
    });
  });

  it("rejects a missing or wrongly typed customer owner account", async () => {
    const missingAccount = createRefundHarness({
      customerAccountOverride: null,
    });
    const vendorRoleAccount = createRefundHarness({
      customerAccountOverride: {
        ...customerAccount,
        role: "vendor",
      },
    });
    const command = {
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 5,
      reason: "Customer owner account integrity test.",
      idempotencyKey: "test:refund:customer-account",
    };

    await expect(
      missingAccount.service.createRefund(command),
    ).rejects.toMatchObject({
      code: "REFUND_CUSTOMER_ACCOUNT_INVALID",
    });
    await expect(
      vendorRoleAccount.service.createRefund(command),
    ).rejects.toMatchObject({
      code: "REFUND_CUSTOMER_ACCOUNT_INVALID",
    });
  });

  it("rejects a refund from a negative customer ledger balance", async () => {
    const { service, state } = createRefundHarness({
      customerOpeningEntries: [],
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 1,
        reason: "Corrupt customer balance must be rejected.",
        idempotencyKey: "test:refund:negative-customer-balance",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_CUSTOMER_BALANCE_INVALID",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  it("rejects a refund whose customer credit would overflow", async () => {
    const maximumCustomerCredit: LedgerEntry = {
      ...customerOpeningCredit,
      id: "ledger-customer-maximum-credit",
      tokenAmount: Number.MAX_SAFE_INTEGER,
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:refund:maximum-customer-credit",
      ),
    };
    const balancingCustomerCredit: LedgerEntry = {
      ...customerOpeningCredit,
      id: "ledger-customer-balancing-credit",
      transactionGroupId: "transaction-customer-balancing-credit",
      entryType: "administrative_adjustment",
      tokenAmount: order.tokenTotal,
      actorAccountId: "account-administrator-001",
      relatedEvidenceId: null,
      reference: "ADJ-BALANCING",
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:refund:balancing-customer-credit",
      ),
    };
    const { service, state } = createRefundHarness({
      customerOpeningEntries: [maximumCustomerCredit, balancingCustomerCredit],
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 1,
        reason: "Unsafe customer credit projection test.",
        idempotencyKey: "test:refund:customer-overflow",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_CUSTOMER_BALANCE_OVERFLOW",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  it("rejects tampered prior refund reversal pairs", async () => {
    const { service, state } = createRefundHarness();

    await service.createRefund({
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 5,
      reason: "Initial valid refund.",
      idempotencyKey: "test:refund:prior-valid",
    });

    const vendorRefundIndex = state.ledgerEntries.findIndex(
      ({ entryType }) => entryType === "vendor_refund",
    );
    const vendorRefund = state.ledgerEntries[vendorRefundIndex];

    expect(vendorRefund).toBeDefined();
    state.ledgerEntries[vendorRefundIndex] = {
      ...vendorRefund!,
      reversesLedgerEntryId: customerPurchaseDebit.id,
    };

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Tampered prior ledger pair must block another refund.",
        idempotencyKey: "test:refund:after-prior-tamper",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_PRIOR_RECORDS_INVALID",
    });

    expect(state.refunds).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("rejects orphan refund ledger entries without a refund record", async () => {
    const { service, state } = createRefundHarness();

    await service.createRefund({
      actorAccountId: vendorAccount.id,
      orderId: order.id,
      tokenAmount: 5,
      reason: "Create ledger entries that will be orphaned.",
      idempotencyKey: "test:refund:orphan-source",
    });
    state.refunds.splice(0, state.refunds.length);

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Orphan refund entries must block another refund.",
        idempotencyKey: "test:refund:after-orphan",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_PRIOR_RECORDS_INVALID",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("rejects a generated transaction-group collision before appending", async () => {
    const { service, state } = createRefundHarness();
    state.ledgerEntries.push({
      ...customerOpeningCredit,
      id: "ledger-refund-group-collision",
      transactionGroupId: "transaction-refund-generated-1",
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:refund:group-collision-reservation",
      ),
    });

    await expect(
      service.createRefund({
        actorAccountId: vendorAccount.id,
        orderId: order.id,
        tokenAmount: 5,
        reason: "Generated transaction group collision test.",
        idempotencyKey: "test:refund:group-collision",
      }),
    ).rejects.toMatchObject({
      code: "REFUND_TRANSACTION_GROUP_COLLISION",
    });

    expect(state.refunds).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });
});
