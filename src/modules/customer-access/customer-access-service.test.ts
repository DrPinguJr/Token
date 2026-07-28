import { describe, expect, it } from "vitest";

import type { Account } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type { LedgerEntry } from "@/modules/transactions";
import type { Wallet } from "@/modules/wallets";

import {
  CustomerAccessQuery,
  type CustomerAccessMutationRepositories,
  type CustomerAccessQueryRepositories,
} from "./customer-access-query";
import {
  ClaimQrAlreadyUsedError,
  CustomerAccessService,
} from "./customer-access-service";

const now = "2026-07-28T10:00:00.000Z";
const lancePrivateAccessCode = "49281730659482017364920581736490";
const lanceClaimCode = "claim_73049281764059281630495726184015";

const adminAccount: Account = Object.freeze({
  id: "account-admin-001",
  mobileNumber: "90000004",
  displayName: "Morgan Control",
  role: "administrator",
  status: "active",
  createdAt: now,
  updatedAt: now,
});

const customerAccount: Account = Object.freeze({
  id: "account-customer-001",
  mobileNumber: "90000001",
  displayName: "Lance Tan",
  role: "customer",
  status: "active",
  createdAt: now,
  updatedAt: now,
});

const customer: Customer = Object.freeze({
  id: "customer-001",
  accountId: customerAccount.id,
  walletId: "wallet-customer-001",
  privateAccessCode: lancePrivateAccessCode,
  claimCode: lanceClaimCode,
  claimExpiresAt: "2026-07-28T10:15:00.000Z",
  claimedAt: null,
  publicCode: "cus_OLD_WALLET",
  walletQrUpdatedAt: "2026-07-01T01:00:00.000Z",
  onboardingCompletedAt: null,
  createdAt: "2026-07-01T01:00:00.000Z",
  updatedAt: "2026-07-01T01:00:00.000Z",
});

const wallet: Wallet = Object.freeze({
  id: "wallet-customer-001",
  ownerAccountId: customerAccount.id,
  ownerType: "customer",
  status: "active",
  createdAt: "2026-07-01T01:00:00.000Z",
});

const issuance: LedgerEntry = Object.freeze({
  id: "ledger-001",
  walletId: wallet.id,
  transactionGroupId: "transaction-001",
  entryType: "token_issuance",
  direction: "credit",
  tokenAmount: 30,
  actorAccountId: "account-staff-001",
  relatedCustomerId: customer.id,
  relatedVendorId: null,
  relatedOrderId: null,
  relatedEvidenceId: null,
  reference: "ISS-001",
  description: "Manual token issuance recorded by event staff.",
  occurredAt: "2026-07-28T09:00:00.000Z",
  idempotencyKey: "operation:seed-issuance",
  metadata: {},
  reversesLedgerEntryId: null,
});

interface Harness {
  readonly audits: AuditLog[];
  readonly getCustomer: () => Customer;
  readonly query: CustomerAccessQuery;
  readonly service: CustomerAccessService;
}

function createHarness(initialCustomer: Customer = customer): Harness {
  let persistedCustomer = initialCustomer;
  const audits: AuditLog[] = [];
  const accounts = [adminAccount, customerAccount];
  const repositories: CustomerAccessMutationRepositories = {
    accounts: {
      getById: async (id) =>
        accounts.find((account) => account.id === id) ?? null,
    },
    auditLogs: {
      append: async (entry) => {
        audits.push(entry);
      },
    },
    customers: {
      getById: async (id) =>
        id === persistedCustomer.id ? persistedCustomer : null,
      list: async () => [persistedCustomer],
      update: async (nextCustomer) => {
        persistedCustomer = nextCustomer;
      },
    },
    ledgerEntries: {
      findByWalletId: async () => [issuance],
    },
    vendors: {
      list: async () => [],
    },
    wallets: {
      getById: async (id) => (id === wallet.id ? wallet : null),
    },
  };

  return {
    audits,
    getCustomer: () => persistedCustomer,
    query: new CustomerAccessQuery({
      run<Result>(
        work: (
          queryRepositories: CustomerAccessQueryRepositories,
        ) => Promise<Result>,
      ): Promise<Result> {
        return work(repositories);
      },
    }),
    service: new CustomerAccessService({
      clock: { now: () => now },
      idProvider: { generateId: (recordType) => `${recordType}:test` },
      transactionRunner: {
        run<Result>(
          work: (
            mutationRepositories: CustomerAccessMutationRepositories,
          ) => Promise<Result>,
        ): Promise<Result> {
          return work(repositories);
        },
      },
    }),
  };
}

describe("CustomerAccessService", () => {
  it("claims a one-time QR and returns only the private account path", async () => {
    const harness = createHarness();

    await expect(harness.service.claim(lanceClaimCode)).resolves.toEqual({
      displayName: "Lance Tan",
      privateAccountPath: `/card/${lancePrivateAccessCode}`,
    });

    expect(harness.getCustomer().claimedAt).toBe(now);
    expect(harness.audits).toEqual([
      expect.objectContaining({
        eventType: "customer_claim_qr_claimed",
        actorAccountId: customerAccount.id,
        targetId: customer.id,
      }),
    ]);
    await expect(harness.service.claim(lanceClaimCode)).rejects.toBeInstanceOf(
      ClaimQrAlreadyUsedError,
    );
  });

  it("regenerates only the wallet QR and keeps the private account link stable", async () => {
    const harness = createHarness({ ...customer, claimedAt: now });
    const before = await harness.query.getPrivateAccount(
      lancePrivateAccessCode,
    );

    await harness.service.regenerateWalletQr(lancePrivateAccessCode);
    const after = await harness.query.getPrivateAccount(lancePrivateAccessCode);

    expect(after.privateAccountPath).toBe(before.privateAccountPath);
    expect(after.walletPublicCode).not.toBe(before.walletPublicCode);
    expect(after.walletQrPayload).not.toContain(lancePrivateAccessCode);
    expect(after.walletQrPayload).toContain(after.walletPublicCode);
  });

  it("lets an administrator refresh a short-lived claim QR", async () => {
    const harness = createHarness({ ...customer, claimedAt: now });

    await harness.service.refreshClaimQr(adminAccount.id, customer.id);

    expect(harness.getCustomer()).toMatchObject({
      claimedAt: null,
      claimExpiresAt: "2026-07-28T10:15:00.000Z",
    });
    expect(harness.getCustomer().claimCode).not.toBe(customer.claimCode);
  });
});
