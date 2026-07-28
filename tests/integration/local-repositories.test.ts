import "fake-indexeddb/auto";

import { Blob as NodeBlob } from "node:buffer";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Account, type AccountPinCredential } from "@/modules/accounts";
import {
  SensitiveAuditMetadataError,
  type AuditLog,
} from "@/modules/audit-logs";
import { type Customer } from "@/modules/customers";
import { type EventSettings } from "@/modules/event-settings";
import {
  EvidenceContentValidationError,
  type Evidence,
} from "@/modules/evidence";
import { type Order } from "@/modules/orders";
import { type Product } from "@/modules/products";
import { type Refund } from "@/modules/refunds";
import { type Settlement } from "@/modules/settlements";
import { type TokenIssuance } from "@/modules/token-issuance";
import { type LedgerEntry } from "@/modules/transactions";
import { type Vendor } from "@/modules/vendors";
import { type Wallet } from "@/modules/wallets";
import {
  getLocalDataMetadata,
  initializeLocalData,
  resetLocalData,
} from "@/config/local-data";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositoryRegistry,
  type LocalRepositories,
} from "@/config/local-repositories";
import {
  TOKENLY_DATABASE_SCHEMA_VERSION,
  StoredRecordConflictError,
  StoredRecordNotFoundError,
  StoredRecordValidationError,
  closeTokenlyDatabaseConnections,
  openTokenlyDatabase,
  tokenlyDataStoreNames,
  tokenlyStoreNames,
} from "@/shared/data";

Object.defineProperty(globalThis, "Blob", {
  configurable: true,
  value: NodeBlob,
});

const createdAt = "2026-07-25T01:00:00.000Z";
const updatedAt = "2026-07-25T02:00:00.000Z";

const account: Account = {
  id: "account-customer-test",
  mobileNumber: "91111111",
  displayName: "Test Customer",
  role: "customer",
  status: "active",
  createdAt,
  updatedAt: createdAt,
};

const accountPinCredential: AccountPinCredential = {
  accountId: account.id,
  pinCredential: "prototype-credential",
  failedPinAttempts: 0,
  lockedUntil: null,
};

const customer: Customer = {
  id: "customer-test",
  accountId: account.id,
  walletId: "wallet-customer-test",
  publicCode: "cus_TEST1234",
  onboardingCompletedAt: null,
  createdAt,
  updatedAt: createdAt,
};

const wallet: Wallet = {
  id: customer.walletId,
  ownerAccountId: account.id,
  ownerType: "customer",
  status: "active",
  createdAt,
};

const vendorAccount: Account = {
  ...account,
  id: "account-vendor-test",
  mobileNumber: "92222222",
  displayName: "Test Vendor Account",
  role: "vendor",
};

const vendorPinCredential: AccountPinCredential = {
  ...accountPinCredential,
  accountId: vendorAccount.id,
};

const vendorWallet: Wallet = {
  id: "wallet-vendor-test",
  ownerAccountId: vendorAccount.id,
  ownerType: "vendor",
  status: "active",
  createdAt,
};

const vendor: Vendor = {
  id: "vendor-test",
  accountId: vendorAccount.id,
  walletId: vendorWallet.id,
  publicCode: "vnd_TEST1234",
  displayName: "Test Vendor",
  logo: null,
  banner: null,
  description: "Fictional test vendor.",
  stallLocation: "Test Hall",
  operatingStatus: "open",
  createdAt,
  updatedAt: createdAt,
};

const product: Product = {
  id: "product-test",
  vendorId: vendor.id,
  name: "Test Product",
  description: "Fictional product.",
  image: null,
  tokenPrice: 5,
  category: "Test",
  isAvailable: true,
  isSoldOut: false,
  isArchived: false,
  displayOrder: 0,
  createdAt,
  updatedAt: createdAt,
};

const evidenceBlob = new Blob(["png"], { type: "image/png" });

const evidence: Evidence = {
  id: "evidence-test",
  kind: "paynow_screenshot",
  fileName: "prototype.png",
  mimeType: "image/png",
  sizeBytes: evidenceBlob.size,
  localBlobKey: "blob-evidence-test",
  capturedByAccountId: "account-staff-test",
  createdAt,
  metadata: {
    source: "staff_provided",
    captureMode: "file_upload",
    originalFileLastModifiedAt: "2026-07-25T00:59:00.000Z",
  },
};

const issuance: TokenIssuance = {
  id: "issuance-test",
  customerId: customer.id,
  walletId: wallet.id,
  staffAccountId: "account-staff-test",
  evidenceId: evidence.id,
  paynowAmountCents: 500,
  tokensPerDollar: 10,
  tokenAmount: 50,
  paymentReference: "TEST-PAYMENT-1",
  normalizedPaymentReference: "test-payment-1",
  note: null,
  transactionGroupId: "transaction-issuance-test",
  reference: "ISS-TEST-1",
  idempotencyKey: "test:issuance:1",
  createdAt,
};

const order: Order = {
  id: "order-test",
  reference: "ORD-TEST-1",
  customerId: customer.id,
  vendorId: vendor.id,
  customerWalletId: wallet.id,
  vendorWalletId: vendorWallet.id,
  status: "completed",
  items: [
    {
      productId: product.id,
      productName: product.name,
      unitTokenPrice: product.tokenPrice,
      quantity: 2,
      lineTokenTotal: 10,
      displayOrder: 0,
    },
  ],
  tokenTotal: 10,
  transactionGroupId: "transaction-order-test",
  idempotencyKey: "test:order:1",
  completedAt: createdAt,
};

const refund: Refund = {
  id: "refund-test",
  reference: "REF-TEST-1",
  orderId: order.id,
  customerId: customer.id,
  vendorId: vendor.id,
  tokenAmount: 5,
  reason: "Fictional contract-test refund.",
  actorAccountId: vendorAccount.id,
  transactionGroupId: "transaction-refund-test",
  idempotencyKey: "test:refund:1",
  createdAt: updatedAt,
};

const customerLedgerEntry: LedgerEntry = {
  id: "ledger-test",
  walletId: wallet.id,
  transactionGroupId: order.transactionGroupId,
  entryType: "customer_purchase",
  direction: "debit",
  tokenAmount: order.tokenTotal,
  actorAccountId: account.id,
  relatedCustomerId: customer.id,
  relatedVendorId: vendor.id,
  relatedOrderId: order.id,
  relatedEvidenceId: null,
  reference: order.reference,
  description: "Contract-test customer debit.",
  occurredAt: createdAt,
  idempotencyKey: "test:ledger:customer-debit",
  metadata: { source: "contract_test" },
  reversesLedgerEntryId: null,
};

const settlement: Settlement = {
  id: "settlement-test",
  reference: "SET-TEST-1",
  vendorId: vendor.id,
  periodStart: "2026-07-25T00:00:00.000Z",
  periodEnd: "2026-07-26T00:00:00.000Z",
  earnedTokenAmount: 10,
  status: "draft",
  payoutReference: null,
  notes: null,
  createdByAccountId: "account-admin-test",
  approvedByAccountId: null,
  paidByAccountId: null,
  createdAt,
  updatedAt: createdAt,
};

const auditLog: AuditLog = {
  id: "audit-test",
  eventType: "purchase_completed",
  actorAccountId: account.id,
  targetType: "order",
  targetId: order.id,
  description: "Contract-test purchase record.",
  occurredAt: createdAt,
  metadata: { source: "contract_test" },
  transactionGroupId: order.transactionGroupId,
};

const eventSettings: EventSettings = {
  id: "event-settings-test",
  eventName: "Tokenly Test Event",
  eventSubtitle: "Fictional repository contract test",
  eventDates: {
    startsAt: "2026-07-25T00:00:00.000Z",
    endsAt: "2026-07-26T00:00:00.000Z",
  },
  venue: "Test Hall",
  tokensPerDollar: 10,
  supportLabel: "Test support",
  supportContact: "support@example.invalid",
  supportInstructions: "Use only for local automated tests.",
  updatedByAccountId: "account-admin-test",
  updatedAt: createdAt,
};

let databaseNumber = 0;
let databaseName = "";
let repositories: LocalRepositories;

beforeEach(async () => {
  databaseNumber += 1;
  databaseName = `tokenly-repository-test-${databaseNumber}`;
  repositories = await createLocalRepositories({ databaseName });
});

afterEach(async () => {
  await repositories.close();
  await deleteDB(databaseName);
  await closeTokenlyDatabaseConnections();
  await resetLocalData();
});

describe("versioned Tokenly IndexedDB", () => {
  it("creates the fixed schema and all known data stores", async () => {
    const database = await openTokenlyDatabase(databaseName);
    const productStore = database.transaction(tokenlyStoreNames.products).store;

    expect(database.version).toBe(TOKENLY_DATABASE_SCHEMA_VERSION);
    expect([...database.objectStoreNames].sort()).toEqual(
      [...tokenlyDataStoreNames, tokenlyStoreNames.dataMetadata].sort(),
    );
    expect([...productStore.indexNames]).toEqual(
      expect.arrayContaining([
        "by-vendor-and-availability",
        "by-vendor-and-sold-out",
        "by-vendor-and-archived",
      ]),
    );
  });

  it("round-trips every repository contract through one shared database", async () => {
    await repositories.accounts.create(account, accountPinCredential);
    await repositories.accounts.create(vendorAccount, vendorPinCredential);
    await repositories.customers.create(customer);
    await repositories.wallets.create(wallet);
    await repositories.wallets.create(vendorWallet);
    await repositories.vendors.create(vendor);
    await repositories.products.create(product);
    await repositories.evidence.create(evidence, evidenceBlob);
    await repositories.tokenIssuances.create(issuance);
    await repositories.orders.create(order);
    await repositories.refunds.create(refund);
    await repositories.ledgerEntries.append(customerLedgerEntry);
    await repositories.settlements.create(settlement);
    await repositories.auditLogs.append(auditLog);
    await repositories.eventSettings.save(eventSettings);

    expect(
      await repositories.accounts.getByMobileNumber(account.mobileNumber),
    ).toEqual(account);
    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        account.id,
      ),
    ).toEqual(accountPinCredential);
    expect(await repositories.accounts.getById(account.id)).not.toHaveProperty(
      "pinCredential",
    );
    expect(await repositories.accounts.list({ role: "vendor" })).toEqual([
      vendorAccount,
    ]);
    expect(
      await repositories.customers.getByPublicCode(customer.publicCode),
    ).toEqual(customer);
    expect(
      await repositories.customers.getByWalletId(customer.walletId),
    ).toEqual(customer);
    expect(await repositories.wallets.getByOwnerAccountId(account.id)).toEqual(
      wallet,
    );
    expect(await repositories.vendors.getByAccountId(vendorAccount.id)).toEqual(
      vendor,
    );
    expect(await repositories.vendors.getByWalletId(vendor.walletId)).toEqual(
      vendor,
    );
    expect(await repositories.products.list({ vendorId: vendor.id })).toEqual([
      product,
    ]);
    expect(
      await repositories.products.list({
        vendorId: vendor.id,
        isAvailable: true,
        isArchived: false,
      }),
    ).toEqual([product]);
    const storedEvidence = await repositories.evidence.getContentById(
      evidence.id,
    );
    expect(storedEvidence).toMatchObject({
      size: evidenceBlob.size,
      type: evidenceBlob.type,
    });
    await expect(storedEvidence?.text()).resolves.toBe("png");
    expect(
      await repositories.tokenIssuances.findByNormalizedPaymentReference(
        "test-payment-1",
      ),
    ).toEqual([issuance]);
    expect(
      await repositories.tokenIssuances.getByTransactionGroupId(
        issuance.transactionGroupId,
      ),
    ).toEqual(issuance);
    expect(
      await repositories.orders.getByTransactionGroupId(
        order.transactionGroupId,
      ),
    ).toEqual(order);
    expect(await repositories.refunds.findByOrderId(order.id)).toEqual([
      refund,
    ]);
    expect(
      await repositories.refunds.getByTransactionGroupId(
        refund.transactionGroupId,
      ),
    ).toEqual(refund);
    expect(
      await repositories.ledgerEntries.findByWalletAndIdempotencyKey(
        wallet.id,
        customerLedgerEntry.idempotencyKey,
      ),
    ).toEqual(customerLedgerEntry);
    expect(await repositories.ledgerEntries.findByWalletId(wallet.id)).toEqual([
      customerLedgerEntry,
    ]);
    expect(
      await repositories.ledgerEntries.findByRelatedOrderId(order.id),
    ).toEqual([customerLedgerEntry]);
    expect(
      await repositories.ledgerEntries.getByIdempotencyKey(
        customerLedgerEntry.idempotencyKey,
      ),
    ).toEqual(customerLedgerEntry);
    expect(
      await repositories.settlements.getByReference(settlement.reference),
    ).toEqual(settlement);
    expect(
      await repositories.auditLogs.findByTransactionGroupId(
        order.transactionGroupId,
      ),
    ).toEqual([auditLog]);
    expect(await repositories.eventSettings.get()).toEqual(eventSettings);
  });

  it("supports defined updates without silently inserting missing records", async () => {
    await repositories.accounts.create(account, accountPinCredential);
    const updatedAccount = {
      ...account,
      displayName: "Updated Customer",
      updatedAt,
    };

    await repositories.accounts.update(updatedAccount);
    const lockedCredential = {
      ...accountPinCredential,
      failedPinAttempts: 3,
      lockedUntil: updatedAt,
    };
    await repositories.accountPinCredentials.updatePinCredential(
      lockedCredential,
    );

    expect(await repositories.accounts.getById(account.id)).toEqual(
      updatedAccount,
    );
    expect(
      await repositories.accountPinCredentials.getPinCredentialByAccountId(
        account.id,
      ),
    ).toEqual(lockedCredential);
    await expect(repositories.products.update(product)).rejects.toBeInstanceOf(
      StoredRecordNotFoundError,
    );
  });

  it("enforces unique indexed values and append-only IDs", async () => {
    await repositories.accounts.create(account, accountPinCredential);

    await expect(
      repositories.accounts.create(
        {
          ...account,
          id: "account-duplicate-mobile",
        },
        {
          ...accountPinCredential,
          accountId: "account-duplicate-mobile",
        },
      ),
    ).rejects.toBeInstanceOf(StoredRecordConflictError);

    await repositories.ledgerEntries.append(customerLedgerEntry);
    await expect(
      repositories.ledgerEntries.append({
        ...customerLedgerEntry,
        id: "ledger-duplicate-idempotency",
        walletId: vendorWallet.id,
      }),
    ).rejects.toBeInstanceOf(StoredRecordConflictError);
  });

  it("rejects evidence bytes that do not match validated metadata", async () => {
    await expect(
      repositories.evidence.create(
        evidence,
        new Blob(["different"], { type: "image/png" }),
      ),
    ).rejects.toBeInstanceOf(EvidenceContentValidationError);

    expect(await repositories.evidence.getById(evidence.id)).toBeNull();
  });

  it("rejects stored evidence whose Blob MIME type was tampered", async () => {
    await repositories.evidence.create(evidence, evidenceBlob);
    const database = await openTokenlyDatabase(databaseName);

    await database.put(tokenlyStoreNames.evidenceContents, {
      id: evidence.localBlobKey,
      evidenceId: evidence.id,
      mimeType: evidence.mimeType,
      content: new Blob(["png"], { type: "image/jpeg" }),
    });

    await expect(
      repositories.evidence.getContentById(evidence.id),
    ).rejects.toBeInstanceOf(EvidenceContentValidationError);
  });

  it("rejects payment-verification claims in evidence metadata", async () => {
    const evidenceWithVerificationClaim = {
      ...evidence,
      id: "evidence-verification-claim",
      localBlobKey: "blob-evidence-verification-claim",
      metadata: {
        ...evidence.metadata,
        paymentVerificationStatus: "verified",
      },
    } as unknown as Evidence;

    await expect(
      repositories.evidence.create(evidenceWithVerificationClaim, evidenceBlob),
    ).rejects.toMatchObject({ name: "ZodError" });

    expect(
      await repositories.evidence.getById(evidenceWithVerificationClaim.id),
    ).toBeNull();
  });

  it("rejects sensitive metadata through the direct audit repository", async () => {
    const unsafeAuditLog: AuditLog = {
      ...auditLog,
      id: "audit-sensitive-metadata",
      metadata: {
        walletPin: "must-not-persist",
      },
    };

    await expect(
      repositories.auditLogs.append(unsafeAuditLog),
    ).rejects.toBeInstanceOf(SensitiveAuditMetadataError);

    expect(await repositories.auditLogs.getById(unsafeAuditLog.id)).toBeNull();
  });

  it("commits evidence and linked records through one repository unit of work", async () => {
    await runInLocalRepositoryTransaction(
      async (transactionRepositories) => {
        await transactionRepositories.evidence.create(evidence, evidenceBlob);
        await transactionRepositories.tokenIssuances.create(issuance);
        await transactionRepositories.ledgerEntries.append(customerLedgerEntry);
        await transactionRepositories.auditLogs.append(auditLog);
      },
      { databaseName },
    );

    expect(
      await repositories.evidence.getContentById(evidence.id),
    ).not.toBeNull();
    expect(await repositories.tokenIssuances.getById(issuance.id)).toEqual(
      issuance,
    );
    expect(
      await repositories.ledgerEntries.getById(customerLedgerEntry.id),
    ).toEqual(customerLedgerEntry);
    expect(await repositories.auditLogs.getById(auditLog.id)).toEqual(auditLog);
  });

  it("rolls back every repository write when a unit of work fails", async () => {
    await expect(
      runInLocalRepositoryTransaction(
        async (transactionRepositories) => {
          await transactionRepositories.orders.create(order);
          await transactionRepositories.ledgerEntries.append(
            customerLedgerEntry,
          );
          throw new Error("simulated transaction failure");
        },
        { databaseName },
      ),
    ).rejects.toThrow("simulated transaction failure");

    expect(await repositories.orders.getById(order.id)).toBeNull();
    expect(
      await repositories.ledgerEntries.getById(customerLedgerEntry.id),
    ).toBeNull();
  });

  it("validates unknown persisted records before returning them", async () => {
    const database = await openTokenlyDatabase(databaseName);
    await database.put(tokenlyStoreNames.accounts, {
      ...account,
      role: "untrusted-role",
    });

    await expect(
      repositories.accounts.getById(account.id),
    ).rejects.toBeInstanceOf(StoredRecordValidationError);
  });

  it("resets only the fixed Tokenly database", async () => {
    await repositories.accounts.create(account, accountPinCredential);

    await resetLocalData();

    expect(await repositories.accounts.getById(account.id)).toEqual(account);
  });
});

describe("local data initialization", () => {
  it("records first-run metadata and does not seed twice", async () => {
    await resetLocalData();
    const seed = vi.fn(async (registry: LocalRepositoryRegistry) => {
      await registry.accounts.create(account, accountPinCredential);
    });

    const initialized = await initializeLocalData({
      seedVersion: 1,
      seed,
      now: () => updatedAt,
    });
    const repeated = await initializeLocalData({
      seedVersion: 1,
      seed,
      now: () => "2026-07-25T03:00:00.000Z",
    });

    expect(initialized).toEqual({
      status: "initialized",
      metadata: {
        key: "tokenly-data",
        schemaVersion: 5,
        seedVersion: 1,
        seededAt: updatedAt,
      },
    });
    expect(repeated.status).toBe("already-initialized");
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("removes a partial first-run seed before a retry", async () => {
    await resetLocalData();

    await expect(
      initializeLocalData({
        seedVersion: 1,
        seed: async (registry) => {
          await registry.accounts.create(account, accountPinCredential);
          throw new Error("simulated seed failure");
        },
      }),
    ).rejects.toMatchObject({
      code: "LOCAL_DATA_INITIALIZATION_FAILED",
    });

    const recoveredRepositories = await createLocalRepositories();
    expect(await recoveredRepositories.accounts.list()).toEqual([]);
    expect(await getLocalDataMetadata()).toBeNull();
    await recoveredRepositories.close();
  });

  it("serializes concurrent first-run initialization", async () => {
    await resetLocalData();
    const seed = vi.fn(async (registry: LocalRepositoryRegistry) => {
      await registry.accounts.create(account, accountPinCredential);
    });

    const results = await Promise.all([
      initializeLocalData({ seedVersion: 1, seed, now: () => createdAt }),
      initializeLocalData({ seedVersion: 1, seed, now: () => updatedAt }),
    ]);

    expect(seed).toHaveBeenCalledTimes(1);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "already-initialized",
      "initialized",
    ]);
  });
});
