import { describe, expect, it } from "vitest";

import type { Account } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import {
  createOperationLedgerIdempotencyKey,
  type LedgerEntry,
  type TransactionIdProvider,
} from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import {
  AdministrativeAdjustmentService,
  type AdministrativeAdjustmentTransactionRepositories,
  type Wallet,
} from "@/modules/wallets";

const administrator: Account = {
  id: "account-administrator-001",
  mobileNumber: "90000004",
  displayName: "Test Administrator",
  role: "administrator",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const wallet: Wallet = {
  id: "wallet-customer-001",
  ownerAccountId: "account-customer-001",
  ownerType: "customer",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
};

const customerAccount: Account = {
  id: wallet.ownerAccountId,
  mobileNumber: "90000001",
  displayName: "Adjustment Customer",
  role: "customer",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const customer: Customer = {
  id: "customer-001",
  accountId: customerAccount.id,
  walletId: wallet.id,
  publicCode: "cus_ADJUSTMENT",
  onboardingCompletedAt: "2026-07-25T00:00:00.000Z",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const vendorAccount: Account = {
  id: "account-vendor-001",
  mobileNumber: "90000002",
  displayName: "Adjustment Vendor",
  role: "vendor",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

const vendorWallet: Wallet = {
  id: "wallet-vendor-001",
  ownerAccountId: vendorAccount.id,
  ownerType: "vendor",
  status: "active",
  createdAt: "2026-07-25T00:00:00.000Z",
};

const vendor: Vendor = {
  id: "vendor-001",
  accountId: vendorAccount.id,
  walletId: vendorWallet.id,
  publicCode: "vnd_ADJUSTMENT",
  displayName: "Adjustment Vendor",
  logo: null,
  banner: null,
  description: "Fictional adjustment test vendor.",
  stallLocation: "Test Hall",
  operatingStatus: "open",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

function createOpeningCredit(tokenAmount = 20): LedgerEntry {
  return {
    id: "ledger-opening-credit",
    walletId: wallet.id,
    transactionGroupId: "transaction-opening-credit",
    entryType: "token_issuance",
    direction: "credit",
    tokenAmount,
    actorAccountId: "account-staff-001",
    relatedCustomerId: "customer-001",
    relatedVendorId: null,
    relatedOrderId: null,
    relatedEvidenceId: "evidence-001",
    reference: "ISS-001",
    description: "Opening credit for adjustment service test.",
    occurredAt: "2026-07-25T09:00:00.000Z",
    idempotencyKey: createOperationLedgerIdempotencyKey(
      "test:adjustment:opening-credit",
    ),
    metadata: {},
    reversesLedgerEntryId: null,
  };
}

function createIdProvider(): TransactionIdProvider {
  const counts = new Map<string, number>();

  return {
    generateId: (recordType) => {
      const count = (counts.get(recordType) ?? 0) + 1;
      counts.set(recordType, count);
      return `${recordType}-adjustment-${count}`;
    },
  };
}

function createAdjustmentHarness(options?: {
  readonly actor?: Account | null;
  readonly customerOwner?: Customer | null;
  readonly openingEntries?: readonly LedgerEntry[];
  readonly ownerAccount?: Account | null;
  readonly targetWallet?: Wallet;
  readonly vendorOwner?: Vendor | null;
}) {
  const ledgerEntries = [...(options?.openingEntries ?? [])];
  const auditLogs: AuditLog[] = [];
  const actor =
    options !== undefined && "actor" in options ? options.actor : administrator;
  const targetWallet = options?.targetWallet ?? wallet;
  const ownerAccount =
    options !== undefined && "ownerAccount" in options
      ? options.ownerAccount
      : targetWallet.ownerType === "customer"
        ? customerAccount
        : vendorAccount;
  const customerOwner =
    options !== undefined && "customerOwner" in options
      ? options.customerOwner
      : customer;
  const vendorOwner =
    options !== undefined && "vendorOwner" in options
      ? options.vendorOwner
      : vendor;
  const repositories = {
    accounts: {
      getById: async (id: string) =>
        actor?.id === id
          ? actor
          : ownerAccount?.id === id
            ? ownerAccount
            : null,
    },
    auditLogs: {
      append: async (auditLog: AuditLog) => {
        auditLogs.push(auditLog);
      },
    },
    customers: {
      getByAccountId: async (accountId: string) =>
        customerOwner?.accountId === accountId ? customerOwner : null,
    },
    ledgerEntries: {
      append: async (entry: LedgerEntry) => {
        ledgerEntries.push(entry);
      },
      findByTransactionGroupId: async (transactionGroupId: string) =>
        ledgerEntries.filter(
          (entry) => entry.transactionGroupId === transactionGroupId,
        ),
      findByWalletId: async (walletId: string) =>
        ledgerEntries.filter((entry) => entry.walletId === walletId),
      getByIdempotencyKey: async (idempotencyKey: string) =>
        ledgerEntries.find(
          (entry) => entry.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    vendors: {
      getByAccountId: async (accountId: string) =>
        vendorOwner?.accountId === accountId ? vendorOwner : null,
    },
    wallets: {
      getById: async (id: string) =>
        id === targetWallet.id ? targetWallet : null,
    },
  } satisfies AdministrativeAdjustmentTransactionRepositories;
  const service = new AdministrativeAdjustmentService({
    clock: { now: () => "2026-07-25T12:00:00.000Z" },
    idProvider: createIdProvider(),
    referenceProvider: {
      generateReference: () => "ADJ-GENERATED",
    },
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => "transaction-adjustment-generated",
    },
    transactionRunner: {
      run: async (work) => work(repositories),
    },
  });

  return { auditLogs, ledgerEntries, service };
}

describe("AdministrativeAdjustmentService", () => {
  it("appends an administrator credit and its audit record", async () => {
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness();

    const receipt = await service.createAdjustment({
      actorAccountId: administrator.id,
      walletId: wallet.id,
      direction: "credit",
      tokenAmount: 12,
      reason: "Correct an event desk reconciliation discrepancy.",
      idempotencyKey: "test:adjustment:credit",
    });

    expect(receipt).toMatchObject({
      previousBalance: 0,
      resultingBalance: 12,
      ledgerEntry: {
        direction: "credit",
        entryType: "administrative_adjustment",
        idempotencyKey: createOperationLedgerIdempotencyKey(
          "test:adjustment:credit",
        ),
        relatedCustomerId: customer.id,
        relatedVendorId: null,
        tokenAmount: 12,
      },
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actorAccountId: administrator.id,
      eventType: "administrative_adjustment_created",
      targetType: "ledger_entry",
      transactionGroupId: receipt.ledgerEntry.transactionGroupId,
    });
  });

  it("appends a funded debit and returns the calculated balance", async () => {
    const openingCredit = createOpeningCredit();
    const { service } = createAdjustmentHarness({
      openingEntries: [openingCredit],
    });

    const receipt = await service.createAdjustment({
      actorAccountId: administrator.id,
      walletId: wallet.id,
      direction: "debit",
      tokenAmount: 7,
      reason: "Reverse a duplicate manual desk correction.",
      idempotencyKey: "test:adjustment:debit",
    });

    expect(receipt.previousBalance).toBe(20);
    expect(receipt.resultingBalance).toBe(13);
    expect(receipt.ledgerEntry.direction).toBe("debit");
  });

  it("rejects a debit that would overdraw the wallet", async () => {
    const openingCredit = createOpeningCredit(5);
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness({
      openingEntries: [openingCredit],
    });

    await expect(
      service.createAdjustment({
        actorAccountId: administrator.id,
        walletId: wallet.id,
        direction: "debit",
        tokenAmount: 6,
        reason: "Invalid excessive correction.",
        idempotencyKey: "test:adjustment:overdraw",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_WALLET_BALANCE_INSUFFICIENT",
    });

    expect(ledgerEntries).toEqual([openingCredit]);
    expect(auditLogs).toEqual([]);
  });

  it("requires an active administrator actor and an operational reason", async () => {
    const vendorActor: Account = {
      ...administrator,
      id: "account-vendor-001",
      mobileNumber: "90000002",
      role: "vendor",
    };
    const { service } = createAdjustmentHarness({ actor: vendorActor });

    await expect(
      service.createAdjustment({
        actorAccountId: vendorActor.id,
        walletId: wallet.id,
        direction: "credit",
        tokenAmount: 5,
        reason: "Vendor accounts cannot adjust wallets.",
        idempotencyKey: "test:adjustment:vendor",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_ACTOR_NOT_ACTIVE_ADMINISTRATOR",
    });

    await expect(
      service.createAdjustment({
        actorAccountId: vendorActor.id,
        walletId: wallet.id,
        direction: "credit",
        tokenAmount: 5,
        reason: "   ",
        idempotencyKey: "test:adjustment:no-reason",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_INVALID_COMMAND",
    });
  });

  it("rejects duplicate adjustment submissions", async () => {
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness();
    const command = {
      actorAccountId: administrator.id,
      walletId: wallet.id,
      direction: "credit" as const,
      tokenAmount: 5,
      reason: "Duplicate adjustment submission test.",
      idempotencyKey: "test:adjustment:duplicate",
    };

    await service.createAdjustment(command);

    await expect(service.createAdjustment(command)).rejects.toMatchObject({
      code: "ADJUSTMENT_DUPLICATE_IDEMPOTENCY_KEY",
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(auditLogs).toHaveLength(1);
  });

  it("maps a vendor wallet adjustment to the exact vendor owner profile", async () => {
    const { service } = createAdjustmentHarness({
      targetWallet: vendorWallet,
    });

    const receipt = await service.createAdjustment({
      actorAccountId: administrator.id,
      walletId: vendorWallet.id,
      direction: "credit",
      tokenAmount: 5,
      reason: "Vendor reconciliation correction.",
      idempotencyKey: "test:adjustment:vendor-wallet",
    });

    expect(receipt.ledgerEntry).toMatchObject({
      relatedCustomerId: null,
      relatedVendorId: vendor.id,
      walletId: vendorWallet.id,
    });
  });

  it("rejects a wallet whose owner account and profile mapping is broken", async () => {
    const missingProfile = createAdjustmentHarness({
      customerOwner: null,
    });
    const wrongWalletProfile = createAdjustmentHarness({
      customerOwner: {
        ...customer,
        walletId: "wallet-customer-other",
      },
    });
    const wrongRoleAccount = createAdjustmentHarness({
      ownerAccount: {
        ...customerAccount,
        role: "vendor",
      },
    });
    const command = {
      actorAccountId: administrator.id,
      walletId: wallet.id,
      direction: "credit" as const,
      tokenAmount: 5,
      reason: "Wallet ownership integrity test.",
      idempotencyKey: "test:adjustment:owner-integrity",
    };

    await expect(
      missingProfile.service.createAdjustment(command),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_WALLET_OWNER_INVALID",
    });
    await expect(
      wrongWalletProfile.service.createAdjustment(command),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_WALLET_OWNER_INVALID",
    });
    await expect(
      wrongRoleAccount.service.createAdjustment(command),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_WALLET_OWNER_INVALID",
    });
  });

  it("rejects a credit when the wallet already has a negative balance", async () => {
    const negativeEntry: LedgerEntry = {
      ...createOpeningCredit(1),
      id: "ledger-negative-balance",
      transactionGroupId: "transaction-negative-balance",
      entryType: "administrative_adjustment",
      direction: "debit",
      relatedEvidenceId: null,
      reference: "ADJ-NEGATIVE",
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:adjustment:negative-balance-entry",
      ),
    };
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness({
      openingEntries: [negativeEntry],
    });

    await expect(
      service.createAdjustment({
        actorAccountId: administrator.id,
        walletId: wallet.id,
        direction: "credit",
        tokenAmount: 2,
        reason: "A correction cannot build on a corrupt negative wallet.",
        idempotencyKey: "test:adjustment:negative-current",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_CURRENT_BALANCE_INVALID",
    });

    expect(ledgerEntries).toEqual([negativeEntry]);
    expect(auditLogs).toEqual([]);
  });

  it("rejects a credit whose resulting balance would overflow", async () => {
    const maximumCredit = createOpeningCredit(Number.MAX_SAFE_INTEGER);
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness({
      openingEntries: [maximumCredit],
    });

    await expect(
      service.createAdjustment({
        actorAccountId: administrator.id,
        walletId: wallet.id,
        direction: "credit",
        tokenAmount: 1,
        reason: "Unsafe projected balance test.",
        idempotencyKey: "test:adjustment:overflow",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_RESULTING_BALANCE_UNSAFE",
    });

    expect(ledgerEntries).toEqual([maximumCredit]);
    expect(auditLogs).toEqual([]);
  });

  it("rejects a generated transaction-group collision", async () => {
    const collisionEntry: LedgerEntry = {
      ...createOpeningCredit(5),
      id: "ledger-adjustment-group-collision",
      transactionGroupId: "transaction-adjustment-generated",
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "test:adjustment:group-reservation",
      ),
    };
    const { auditLogs, ledgerEntries, service } = createAdjustmentHarness({
      openingEntries: [collisionEntry],
    });

    await expect(
      service.createAdjustment({
        actorAccountId: administrator.id,
        walletId: wallet.id,
        direction: "credit",
        tokenAmount: 1,
        reason: "Generated transaction group collision test.",
        idempotencyKey: "test:adjustment:group-collision",
      }),
    ).rejects.toMatchObject({
      code: "ADJUSTMENT_TRANSACTION_GROUP_COLLISION",
    });

    expect(ledgerEntries).toEqual([collisionEntry]);
    expect(auditLogs).toEqual([]);
  });
});
