import { describe, expect, it } from "vitest";

import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  type LedgerEntry,
} from "@/modules/transactions";

import {
  createTokenlySeedData,
  seededDevelopmentAccounts,
} from "./tokenly-seed-data";

function groupLedgerEntries(
  entries: readonly LedgerEntry[],
): ReadonlyMap<string, readonly LedgerEntry[]> {
  const grouped = new Map<string, LedgerEntry[]>();

  for (const entry of entries) {
    const group = grouped.get(entry.transactionGroupId) ?? [];
    group.push(entry);
    grouped.set(entry.transactionGroupId, group);
  }

  return grouped;
}

describe("createTokenlySeedData", () => {
  it("returns a deterministic, realistic development scenario", () => {
    const first = createTokenlySeedData();
    const second = createTokenlySeedData();

    expect(second).toEqual(first);
    expect(first.accounts.map((account) => account.mobileNumber)).toEqual(
      expect.arrayContaining(Object.values(seededDevelopmentAccounts)),
    );
    expect(
      first.accounts.filter((account) => account.role === "customer").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      first.accounts.filter((account) => account.role === "vendor").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      first.accounts.filter((account) => account.role === "staff").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      first.accounts.filter((account) => account.role === "administrator")
        .length,
    ).toBe(1);
    expect(first.vendors).toHaveLength(3);

    for (const vendor of first.vendors) {
      expect(
        first.products.filter((product) => product.vendorId === vendor.id)
          .length,
      ).toBeGreaterThanOrEqual(3);
    }

    expect(first.tokenIssuances.length).toBeGreaterThan(0);
    expect(first.orders.length).toBeGreaterThan(0);
    expect(first.refunds).toHaveLength(2);
    expect(first.settlements).toHaveLength(1);
    expect(first.auditLogs.length).toBeGreaterThan(0);
    for (const account of first.accounts) {
      expect("pinCredential" in account).toBe(false);
    }
    for (const credential of first.accountPinCredentials) {
      expect(credential.pinCredential).toMatch(
        /^prototype-sha256-v1\$[a-f0-9]{64}$/,
      );
    }
    expect(
      first.accountPinCredentials.map((credential) => credential.accountId),
    ).toEqual(first.accounts.map((account) => account.id));
  });

  it("uses unique ledger idempotency keys and conserved transfer groups", () => {
    const seed = createTokenlySeedData();
    const idempotencyKeys = seed.ledgerEntries.map(
      (entry) => entry.idempotencyKey,
    );
    const groupedEntries = groupLedgerEntries(seed.ledgerEntries);

    expect(new Set(idempotencyKeys).size).toBe(idempotencyKeys.length);

    for (const issuance of seed.tokenIssuances) {
      const group = groupedEntries.get(issuance.transactionGroupId) ?? [];

      expect(group).toHaveLength(1);
      expect(group[0]?.idempotencyKey).toBe(
        createOperationLedgerIdempotencyKey(issuance.idempotencyKey),
      );
    }

    for (const order of seed.orders) {
      const group = groupedEntries.get(order.transactionGroupId) ?? [];
      const customerDebit = group.find(
        (entry) => entry.entryType === "customer_purchase",
      );
      const vendorCredit = group.find(
        (entry) => entry.entryType === "vendor_receipt",
      );

      expect(customerDebit).toMatchObject({
        direction: "debit",
        idempotencyKey: createOperationLedgerIdempotencyKey(
          order.idempotencyKey,
        ),
        tokenAmount: order.tokenTotal,
        relatedOrderId: order.id,
      });
      expect(vendorCredit).toMatchObject({
        direction: "credit",
        idempotencyKey: createScopedLedgerIdempotencyKey(
          order.idempotencyKey,
          "vendor-credit",
        ),
        tokenAmount: order.tokenTotal,
        relatedOrderId: order.id,
      });
    }

    for (const refund of seed.refunds) {
      const group = groupedEntries.get(refund.transactionGroupId) ?? [];
      const customerCredit = group.find(
        (entry) => entry.entryType === "customer_refund",
      );
      const vendorDebit = group.find(
        (entry) => entry.entryType === "vendor_refund",
      );

      expect(customerCredit).toMatchObject({
        direction: "credit",
        idempotencyKey: createOperationLedgerIdempotencyKey(
          refund.idempotencyKey,
        ),
        tokenAmount: refund.tokenAmount,
        relatedOrderId: refund.orderId,
      });
      expect(vendorDebit).toMatchObject({
        direction: "debit",
        idempotencyKey: createScopedLedgerIdempotencyKey(
          refund.idempotencyKey,
          "vendor-debit",
        ),
        tokenAmount: refund.tokenAmount,
        relatedOrderId: refund.orderId,
      });
      expect(customerCredit?.reversesLedgerEntryId).not.toBeNull();
      expect(vendorDebit?.reversesLedgerEntryId).not.toBeNull();
    }

    const seededOrder = seed.orders[0];
    expect(seededOrder).toBeDefined();
    if (seededOrder !== undefined) {
      const oldSuffixCollisionBase = `${seededOrder.idempotencyKey}:vendor-credit`;
      const liveOperationReservation = createOperationLedgerIdempotencyKey(
        oldSuffixCollisionBase,
      );
      const seededVendorEntryKey = createScopedLedgerIdempotencyKey(
        seededOrder.idempotencyKey,
        "vendor-credit",
      );

      expect(liveOperationReservation).not.toBe(seededVendorEntryKey);
      expect(idempotencyKeys).not.toContain(liveOperationReservation);
    }
  });

  it("keeps every seeded wallet non-negative throughout its history", () => {
    const seed = createTokenlySeedData();
    const balances = new Map<string, number>();
    const chronologicalEntries = [...seed.ledgerEntries].sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    );

    for (const entry of chronologicalEntries) {
      const currentBalance = balances.get(entry.walletId) ?? 0;
      const nextBalance =
        currentBalance +
        (entry.direction === "credit" ? entry.tokenAmount : -entry.tokenAmount);

      expect(nextBalance).toBeGreaterThanOrEqual(0);
      balances.set(entry.walletId, nextBalance);
    }

    expect(Object.fromEntries(balances)).toEqual({
      "wallet-customer-001": 154,
      "wallet-customer-002": 120,
      "wallet-customer-003": 68,
      "wallet-vendor-001": 40,
      "wallet-vendor-002": 0,
      "wallet-vendor-003": 28,
    });
  });

  it("includes one partial refund, one full refund, and matching evidence", () => {
    const seed = createTokenlySeedData();
    const refundedByOrder = new Map<string, number>();

    for (const refund of seed.refunds) {
      refundedByOrder.set(
        refund.orderId,
        (refundedByOrder.get(refund.orderId) ?? 0) + refund.tokenAmount,
      );
    }

    const orderOne = seed.orders.find((order) => order.id === "order-001");
    const orderTwo = seed.orders.find((order) => order.id === "order-002");

    expect(refundedByOrder.get("order-001")).toBeLessThan(
      orderOne?.tokenTotal ?? 0,
    );
    expect(refundedByOrder.get("order-002")).toBe(orderTwo?.tokenTotal);

    for (const content of seed.evidenceContents) {
      const record = seed.evidence.find(
        (item) => item.id === content.evidenceId,
      );

      expect(record?.sizeBytes).toBe(content.bytes.length);
      expect(record?.mimeType).toBe(content.mimeType);
    }
  });

  it("keeps all cross-store relationships internally consistent", () => {
    const seed = createTokenlySeedData();
    const accountsById = new Map(
      seed.accounts.map((account) => [account.id, account]),
    );
    const customersById = new Map(
      seed.customers.map((customer) => [customer.id, customer]),
    );
    const walletsById = new Map(
      seed.wallets.map((wallet) => [wallet.id, wallet]),
    );
    const vendorsById = new Map(
      seed.vendors.map((vendor) => [vendor.id, vendor]),
    );
    const productsById = new Map(
      seed.products.map((product) => [product.id, product]),
    );
    const ordersById = new Map(seed.orders.map((order) => [order.id, order]));
    const evidenceById = new Map(
      seed.evidence.map((record) => [record.id, record]),
    );
    const ledgerEntriesById = new Map(
      seed.ledgerEntries.map((entry) => [entry.id, entry]),
    );

    for (const customer of seed.customers) {
      expect(accountsById.get(customer.accountId)?.role).toBe("customer");
      expect(walletsById.get(customer.walletId)).toMatchObject({
        ownerAccountId: customer.accountId,
        ownerType: "customer",
      });
    }

    for (const vendor of seed.vendors) {
      expect(accountsById.get(vendor.accountId)?.role).toBe("vendor");
      expect(walletsById.get(vendor.walletId)).toMatchObject({
        ownerAccountId: vendor.accountId,
        ownerType: "vendor",
      });
    }

    for (const order of seed.orders) {
      const customer = customersById.get(order.customerId);
      const vendor = vendorsById.get(order.vendorId);

      expect(customer?.walletId).toBe(order.customerWalletId);
      expect(vendor?.walletId).toBe(order.vendorWalletId);
      for (const item of order.items) {
        expect(productsById.get(item.productId)?.vendorId).toBe(order.vendorId);
      }
    }

    for (const issuance of seed.tokenIssuances) {
      const customer = customersById.get(issuance.customerId);
      const staff = accountsById.get(issuance.staffAccountId);
      const evidence = evidenceById.get(issuance.evidenceId);

      expect(customer?.walletId).toBe(issuance.walletId);
      expect(staff?.role).toBe("staff");
      expect(evidence?.capturedByAccountId).toBe(issuance.staffAccountId);
      expect(
        (issuance.paynowAmountCents * issuance.tokensPerDollar) / 100,
      ).toBe(issuance.tokenAmount);
    }

    for (const refund of seed.refunds) {
      const order = ordersById.get(refund.orderId);
      const vendor = vendorsById.get(refund.vendorId);

      expect(refund.customerId).toBe(order?.customerId);
      expect(refund.vendorId).toBe(order?.vendorId);
      expect(refund.tokenAmount).toBeLessThanOrEqual(order?.tokenTotal ?? 0);
      expect(refund.actorAccountId).toBe(vendor?.accountId);
    }

    for (const entry of seed.ledgerEntries) {
      expect(walletsById.has(entry.walletId)).toBe(true);
      expect(accountsById.has(entry.actorAccountId)).toBe(true);

      if (entry.relatedCustomerId !== null) {
        expect(customersById.has(entry.relatedCustomerId)).toBe(true);
      }
      if (entry.relatedVendorId !== null) {
        expect(vendorsById.has(entry.relatedVendorId)).toBe(true);
      }
      if (entry.relatedOrderId !== null) {
        expect(ordersById.has(entry.relatedOrderId)).toBe(true);
      }
      if (entry.relatedEvidenceId !== null) {
        expect(evidenceById.has(entry.relatedEvidenceId)).toBe(true);
      }
      if (entry.reversesLedgerEntryId !== null) {
        const original = ledgerEntriesById.get(entry.reversesLedgerEntryId);
        const originalOrder =
          entry.relatedOrderId === null
            ? undefined
            : ordersById.get(entry.relatedOrderId);

        expect(original).toBeDefined();
        expect(original?.walletId).toBe(entry.walletId);
        expect(original?.direction).not.toBe(entry.direction);
        expect(original?.relatedOrderId).toBe(entry.relatedOrderId);
        expect(original?.transactionGroupId).toBe(
          originalOrder?.transactionGroupId,
        );
        expect(entry.transactionGroupId).not.toBe(original?.transactionGroupId);
        expect(entry.tokenAmount).toBeLessThanOrEqual(
          original?.tokenAmount ?? 0,
        );
        expect(original?.entryType).toBe(
          entry.entryType === "customer_refund"
            ? "customer_purchase"
            : "vendor_receipt",
        );
      }
    }

    const targetIdsByType = new Map<string, ReadonlySet<string>>([
      ["evidence", new Set(seed.evidence.map((record) => record.id))],
      [
        "token_issuance",
        new Set(seed.tokenIssuances.map((record) => record.id)),
      ],
      ["order", new Set(seed.orders.map((record) => record.id))],
      ["refund", new Set(seed.refunds.map((record) => record.id))],
      ["product", new Set(seed.products.map((record) => record.id))],
      ["settlement", new Set(seed.settlements.map((record) => record.id))],
    ]);
    const knownTransactionGroupIds = new Set([
      ...seed.ledgerEntries.map((entry) => entry.transactionGroupId),
      ...seed.tokenIssuances.map((record) => record.transactionGroupId),
      ...seed.orders.map((record) => record.transactionGroupId),
      ...seed.refunds.map((record) => record.transactionGroupId),
    ]);

    for (const auditLog of seed.auditLogs) {
      expect(accountsById.has(auditLog.actorAccountId)).toBe(true);
      expect(
        targetIdsByType.get(auditLog.targetType)?.has(auditLog.targetId),
      ).toBe(true);

      if (auditLog.transactionGroupId !== null) {
        expect(knownTransactionGroupIds.has(auditLog.transactionGroupId)).toBe(
          true,
        );
      }
    }

    for (const settlement of seed.settlements) {
      const vendor = vendorsById.get(settlement.vendorId);
      const earnedTokenAmount = seed.ledgerEntries
        .filter(
          (entry) =>
            entry.walletId === vendor?.walletId &&
            entry.occurredAt >= settlement.periodStart &&
            entry.occurredAt <= settlement.periodEnd,
        )
        .reduce(
          (total, entry) =>
            total +
            (entry.direction === "credit"
              ? entry.tokenAmount
              : -entry.tokenAmount),
          0,
        );

      expect(earnedTokenAmount).toBe(settlement.earnedTokenAmount);
      expect(accountsById.get(settlement.createdByAccountId)?.role).toBe(
        "administrator",
      );
    }
  });
});
