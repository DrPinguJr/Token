import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalData } from "@/config/local-data";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
} from "@/config/local-repositories";
import { initializeTokenlyApplicationData } from "@/config/seed-tokenly-local-data";
import { TOKENLY_SEED_VERSION } from "@/config/tokenly-seed-data";
import { RefundService } from "@/modules/refunds";
import { openTokenlyDatabase, tokenlyStoreNames } from "@/shared/data";

const seededAt = "2026-07-27T00:00:00.000Z";

describe("local seed lifecycle", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  afterEach(async () => {
    await resetLocalData();
  });

  it("seeds only on first run and records deterministic seed metadata", async () => {
    const first = await initializeTokenlyApplicationData({
      now: () => seededAt,
    });
    const second = await initializeTokenlyApplicationData({
      now: () => "2026-07-28T00:00:00.000Z",
    });
    const repositories = await createLocalRepositories();

    expect(first).toEqual({
      status: "initialized",
      metadata: {
        key: "tokenly-data",
        schemaVersion: 5,
        seedVersion: TOKENLY_SEED_VERSION,
        seededAt,
      },
    });
    expect(second).toEqual({
      status: "already-initialized",
      metadata: first.metadata,
    });
    expect(await repositories.accounts.list()).toHaveLength(9);
    expect(await repositories.vendors.list()).toHaveLength(3);
    expect(await repositories.products.list()).toHaveLength(12);
    expect(await repositories.ledgerEntries.list()).toHaveLength(15);
    expect(await repositories.auditLogs.list()).toHaveLength(16);
    await repositories.close();
  });

  it("replaces changed data through the isolated test reset lifecycle", async () => {
    await initializeTokenlyApplicationData({ now: () => seededAt });
    const repositories = await createLocalRepositories();
    const account = await repositories.accounts.getById("account-customer-001");

    expect(account).not.toBeNull();
    if (account === null) {
      return;
    }

    await repositories.accounts.update({
      ...account,
      status: "disabled",
      updatedAt: "2026-07-27T01:00:00.000Z",
    });
    await repositories.close();

    await resetLocalData();
    const result = await initializeTokenlyApplicationData({
      now: () => seededAt,
    });
    const reseededRepositories = await createLocalRepositories();
    const reseededAccount = await reseededRepositories.accounts.getById(
      "account-customer-001",
    );

    expect(result.status).toBe("initialized");
    expect(reseededAccount?.status).toBe("active");
    await reseededRepositories.close();
  });

  it("rejects version-one data without silently clearing it", async () => {
    await initializeTokenlyApplicationData({ now: () => seededAt });
    const database = await openTokenlyDatabase();

    await database.put(tokenlyStoreNames.dataMetadata, {
      key: "tokenly-data",
      schemaVersion: 1,
      seedVersion: 1,
      seededAt,
    });

    await expect(
      initializeTokenlyApplicationData({ now: () => seededAt }),
    ).rejects.toMatchObject({
      code: "LOCAL_DATA_VERSION_UNSUPPORTED",
      storedVersion: 1,
      supportedVersion: 5,
    });

    const repositories = await createLocalRepositories();
    expect(
      await repositories.accounts.getById("account-customer-001"),
    ).not.toBeNull();
    await repositories.close();
  });

  it("can complete the remaining refund on the canonical seeded order", async () => {
    await initializeTokenlyApplicationData({ now: () => seededAt });
    const generatedCounts = new Map<string, number>();
    const service = new RefundService({
      authorize: async () => undefined,
      clock: { now: () => "2026-07-27T01:00:00.000Z" },
      idProvider: {
        generateId: (recordType) => {
          const count = (generatedCounts.get(recordType) ?? 0) + 1;
          generatedCounts.set(recordType, count);
          return `${recordType}-seed-refund-regression-${count}`;
        },
      },
      referenceProvider: {
        generateReference: () => "REF-SEED-REMAINING",
      },
      transactionGroupIdProvider: {
        generateTransactionGroupId: () => "transaction-refund-seed-remaining",
      },
      transactionRunner: {
        run: (work) =>
          runInLocalRepositoryTransaction((transactionRepositories) =>
            work(transactionRepositories),
          ),
      },
    });

    const receipt = await service.createRefund({
      actorAccountId: "account-vendor-001",
      orderId: "order-001",
      tokenAmount: 18,
      reason: "Complete the remaining seeded refund regression.",
      idempotencyKey: "test:seed:refund:remaining",
    });
    const repositories = await createLocalRepositories();
    const refunds = await repositories.refunds.findByOrderId("order-001");
    const orderEntries =
      await repositories.ledgerEntries.findByRelatedOrderId("order-001");

    expect(receipt.remainingRefundableTokenAmount).toBe(0);
    expect(refunds).toHaveLength(2);
    expect(orderEntries).toHaveLength(6);
    expect(receipt.customerLedgerEntry.reversesLedgerEntryId).toBe(
      "ledger-purchase-001-customer",
    );
    expect(receipt.vendorLedgerEntry.reversesLedgerEntryId).toBe(
      "ledger-purchase-001-vendor",
    );
    await repositories.close();
  });
});
