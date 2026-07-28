import { describe, expect, it } from "vitest";

import type { AccountSummary } from "@/modules/accounts";
import type { Customer } from "@/modules/customers";
import type { EventSettings } from "@/modules/event-settings";
import type { Order } from "@/modules/orders";
import type { Refund } from "@/modules/refunds";
import type { TokenIssuance } from "@/modules/token-issuance";
import type { LedgerEntry } from "@/modules/transactions";
import type { Vendor } from "@/modules/vendors";
import type { Wallet } from "@/modules/wallets";

import {
  CustomerPortalQuery,
  CustomerTransactionNotFoundError,
  type CustomerPortalQueryRepositories,
} from "./index";

const account = Object.freeze({
  id: "account-customer-001",
  mobileNumber: "90000001",
  displayName: "Ari Rally",
  role: "customer",
  status: "active",
  createdAt: "2026-07-01T01:00:00.000Z",
  updatedAt: "2026-07-01T01:00:00.000Z",
} satisfies AccountSummary);

const customer = Object.freeze({
  id: "customer-001",
  accountId: account.id,
  walletId: "wallet-customer-001",
  publicCode: "cus_7F3Q9K2M",
  onboardingCompletedAt: "2026-07-05T02:00:00.000Z",
  createdAt: "2026-07-01T01:00:00.000Z",
  updatedAt: "2026-07-05T02:00:00.000Z",
} satisfies Customer);

const wallet = Object.freeze({
  id: customer.walletId,
  ownerAccountId: account.id,
  ownerType: "customer",
  status: "active",
  createdAt: "2026-07-01T01:00:00.000Z",
} satisfies Wallet);

const settings = Object.freeze({
  id: "event-settings",
  eventName: "Floorball Together 2026",
  eventSubtitle: "Play, cheer, and share a meal.",
  eventDates: {
    startsAt: "2026-07-25T00:00:00.000Z",
    endsAt: "2026-07-27T10:00:00.000Z",
  },
  venue: "Our Tampines Hub",
  tokensPerDollar: 10,
  supportLabel: "Event help",
  supportContact: "Help desk",
  supportInstructions: "Visit the help desk.",
  updatedByAccountId: "account-admin-001",
  updatedAt: "2026-07-01T00:00:00.000Z",
} satisfies EventSettings);

const vendor = Object.freeze({
  id: "vendor-001",
  accountId: "account-vendor-001",
  walletId: "wallet-vendor-001",
  publicCode: "ven_7F3Q9K2M",
  displayName: "Courtside Kitchen",
  logo: null,
  banner: null,
  description: "Event food.",
  stallLocation: "Hall A",
  operatingStatus: "open",
  createdAt: "2026-07-01T01:00:00.000Z",
  updatedAt: "2026-07-01T01:00:00.000Z",
} satisfies Vendor);

function createLedgerEntry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return Object.freeze({
    id: "ledger-issuance-001",
    walletId: wallet.id,
    transactionGroupId: "transaction-issuance-001",
    entryType: "token_issuance",
    direction: "credit",
    tokenAmount: 100,
    actorAccountId: "account-staff-001",
    relatedCustomerId: customer.id,
    relatedVendorId: null,
    relatedOrderId: null,
    relatedEvidenceId: "evidence-001",
    reference: "ISS-001",
    description: "Manual token issuance recorded by event staff.",
    occurredAt: "2026-07-25T00:00:00.000Z",
    idempotencyKey: "operation:8:test-key",
    metadata: {},
    reversesLedgerEntryId: null,
    ...overrides,
  });
}

const order = Object.freeze({
  id: "order-001",
  reference: "ORD-001",
  customerId: customer.id,
  vendorId: vendor.id,
  customerWalletId: wallet.id,
  vendorWalletId: vendor.walletId,
  status: "completed",
  items: [
    {
      productId: "product-food-001",
      productName: "Chicken Rice Bowl",
      unitTokenPrice: 20,
      quantity: 1,
      lineTokenTotal: 20,
      displayOrder: 0,
    },
  ],
  tokenTotal: 20,
  transactionGroupId: "transaction-purchase-001",
  idempotencyKey: "purchase:test-key",
  completedAt: "2026-07-25T01:00:00.000Z",
} satisfies Order);

const refund = Object.freeze({
  id: "refund-001",
  reference: "REF-001",
  orderId: order.id,
  customerId: customer.id,
  vendorId: vendor.id,
  tokenAmount: 5,
  reason: "One item was unavailable.",
  actorAccountId: vendor.accountId,
  transactionGroupId: "transaction-refund-001",
  idempotencyKey: "refund:test-key",
  createdAt: "2026-07-25T02:00:00.000Z",
} satisfies Refund);

const issuance = Object.freeze({
  id: "issuance-001",
  customerId: customer.id,
  walletId: wallet.id,
  staffAccountId: "account-staff-001",
  evidenceId: "evidence-001",
  paynowAmountCents: 1_000,
  tokensPerDollar: 10,
  tokenAmount: 100,
  paymentReference: "PAY-001",
  normalizedPaymentReference: "PAY-001",
  note: null,
  transactionGroupId: "transaction-issuance-001",
  reference: "ISS-001",
  idempotencyKey: "issuance:test-key",
  createdAt: "2026-07-25T00:00:00.000Z",
} satisfies TokenIssuance);

function createRepositories(
  entries: readonly LedgerEntry[],
  overrides: Partial<CustomerPortalQueryRepositories> = {},
): CustomerPortalQueryRepositories {
  const repositories: CustomerPortalQueryRepositories = {
    accounts: {
      getById: async (id) => (id === account.id ? account : null),
    },
    customers: {
      getByAccountId: async (accountId) =>
        accountId === account.id ? customer : null,
    },
    eventSettings: {
      get: async () => settings,
    },
    ledgerEntries: {
      findByTransactionGroupId: async (transactionGroupId) =>
        entries.filter(
          (entry) => entry.transactionGroupId === transactionGroupId,
        ),
      findByWalletId: async (walletId) =>
        entries.filter((entry) => entry.walletId === walletId),
      getById: async (id) => entries.find((entry) => entry.id === id) ?? null,
    },
    orders: {
      getById: async (id) => (id === order.id ? order : null),
      getByTransactionGroupId: async (transactionGroupId) =>
        transactionGroupId === order.transactionGroupId ? order : null,
    },
    refunds: {
      findByOrderId: async (orderId) =>
        orderId === refund.orderId ? [refund] : [],
      getById: async (id) => (id === refund.id ? refund : null),
      getByTransactionGroupId: async (transactionGroupId) =>
        transactionGroupId === refund.transactionGroupId ? refund : null,
    },
    tokenIssuances: {
      getById: async (id) => (id === issuance.id ? issuance : null),
      getByTransactionGroupId: async (transactionGroupId) =>
        transactionGroupId === issuance.transactionGroupId ? issuance : null,
    },
    vendors: {
      getById: async (id) => (id === vendor.id ? vendor : null),
      list: async () => [vendor],
    },
    wallets: {
      getById: async (id) => (id === wallet.id ? wallet : null),
    },
  };

  return { ...repositories, ...overrides };
}

function createQuery(
  repositories: CustomerPortalQueryRepositories,
): CustomerPortalQuery {
  return new CustomerPortalQuery({
    run: async (work) => work(repositories),
  });
}

describe("CustomerPortalQuery", () => {
  it("derives the balance from every ledger entry and includes each customer activity kind", async () => {
    const entries = [
      createLedgerEntry({}),
      createLedgerEntry({
        id: "ledger-purchase-001",
        transactionGroupId: order.transactionGroupId,
        entryType: "customer_purchase",
        direction: "debit",
        tokenAmount: 20,
        actorAccountId: account.id,
        relatedVendorId: vendor.id,
        relatedOrderId: order.id,
        relatedEvidenceId: null,
        reference: order.reference,
        occurredAt: order.completedAt,
      }),
      createLedgerEntry({
        id: "ledger-refund-001",
        transactionGroupId: refund.transactionGroupId,
        entryType: "customer_refund",
        tokenAmount: 5,
        actorAccountId: vendor.accountId,
        relatedVendorId: vendor.id,
        relatedOrderId: order.id,
        relatedEvidenceId: null,
        reference: refund.reference,
        occurredAt: refund.createdAt,
        reversesLedgerEntryId: "ledger-purchase-001",
      }),
      createLedgerEntry({
        id: "ledger-adjustment-001",
        transactionGroupId: "transaction-adjustment-001",
        entryType: "administrative_adjustment",
        direction: "debit",
        tokenAmount: 3,
        actorAccountId: "account-admin-001",
        relatedEvidenceId: null,
        reference: "ADJ-001",
        description: "Correction after event desk reconciliation.",
        occurredAt: "2026-07-25T03:00:00.000Z",
      }),
    ] as const;
    const query = createQuery(createRepositories(entries));

    const home = await query.getHome(account.id);

    expect(home.wallet.balance).toBe(82);
    expect(home.recentTransactions.map((item) => item.kind)).toEqual([
      "adjustment",
      "refund",
      "purchase",
      "issuance",
    ]);
    expect(
      home.recentTransactions.find((item) => item.kind === "purchase"),
    ).toMatchObject({
      transactionId: order.id,
      title: "Purchase at Courtside Kitchen",
      tokenAmount: 20,
    });
  });

  it("loads an owned persisted order receipt with item snapshots and linked refunds", async () => {
    const purchaseEntry = createLedgerEntry({
      id: "ledger-purchase-001",
      transactionGroupId: order.transactionGroupId,
      entryType: "customer_purchase",
      direction: "debit",
      tokenAmount: order.tokenTotal,
      actorAccountId: account.id,
      relatedVendorId: vendor.id,
      relatedOrderId: order.id,
      relatedEvidenceId: null,
      reference: order.reference,
      occurredAt: order.completedAt,
    });
    const query = createQuery(createRepositories([purchaseEntry]));

    const detail = await query.getTransactionDetail(account.id, order.id);

    expect(detail).toMatchObject({
      kind: "purchase",
      reference: order.reference,
      tokenAmount: order.tokenTotal,
      vendorName: vendor.displayName,
      order: {
        id: order.id,
        refundedTokenAmount: refund.tokenAmount,
        tokenTotal: order.tokenTotal,
      },
    });
    expect(detail.order?.items).toEqual([
      {
        productId: "product-food-001",
        productName: "Chicken Rice Bowl",
        unitTokenPrice: 20,
        quantity: 1,
        lineTokenTotal: 20,
      },
    ]);
    expect(detail.refunds).toHaveLength(1);
  });

  it("does not expose an order belonging to another customer", async () => {
    const otherOrder = Object.freeze({
      ...order,
      id: "order-other",
      customerId: "customer-other",
      customerWalletId: "wallet-other",
    });
    const repositories = createRepositories([], {
      orders: {
        getById: async (id) => (id === otherOrder.id ? otherOrder : null),
        getByTransactionGroupId: async () => null,
      },
    });
    const query = createQuery(repositories);

    await expect(
      query.getTransactionDetail(account.id, otherOrder.id),
    ).rejects.toBeInstanceOf(CustomerTransactionNotFoundError);
  });
});
