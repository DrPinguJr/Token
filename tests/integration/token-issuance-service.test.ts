import "fake-indexeddb/auto";

import { Blob as NodeBlob } from "node:buffer";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Account, type AccountPinCredential } from "@/modules/accounts";
import type { AuditLogRepository } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type { EventSettings } from "@/modules/event-settings";
import {
  DuplicatePaymentReferenceAcknowledgementRequiredError,
  TokenIssuanceService,
  type CreateTokenIssuanceCommand,
  type TokenIssuanceTransactionRepositories,
} from "@/modules/token-issuance";
import {
  createOperationLedgerIdempotencyKey,
  DuplicateIdempotencyKeyError,
  DuplicateTransactionGroupIdError,
  type RepositoryTransactionRunner,
  type TransactionClock,
  type TransactionGroupIdProvider,
  type TransactionIdProvider,
  type TransactionReferenceProvider,
} from "@/modules/transactions";
import { calculateWalletBalance, type Wallet } from "@/modules/wallets";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositories,
  type LocalRepositoryRegistry,
} from "@/config/local-repositories";
import { closeTokenlyDatabaseConnections } from "@/shared/data";

Object.defineProperty(globalThis, "Blob", {
  configurable: true,
  value: NodeBlob,
});

const occurredAt = "2026-07-27T06:00:00.000Z";

const staffAccount: Account = {
  id: "account-staff-issuance-test",
  mobileNumber: "93333333",
  displayName: "Issuance Test Staff",
  role: "staff",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customerAccount: Account = {
  id: "account-customer-issuance-test",
  mobileNumber: "91111111",
  displayName: "Issuance Test Customer",
  role: "customer",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

function createCredential(accountId: string): AccountPinCredential {
  return {
    accountId,
    pinCredential: "prototype-credential",
    failedPinAttempts: 0,
    lockedUntil: null,
  };
}

const customer: Customer = {
  id: "customer-issuance-test",
  accountId: customerAccount.id,
  walletId: "wallet-customer-issuance-test",
  publicCode: "cus_ISSUANCE_TEST",
  onboardingCompletedAt: null,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const wallet: Wallet = {
  id: customer.walletId,
  ownerAccountId: customerAccount.id,
  ownerType: "customer",
  status: "active",
  createdAt: occurredAt,
};

const settings: EventSettings = {
  id: "event-settings-issuance-test",
  eventName: "Tokenly Issuance Test",
  eventSubtitle: "Fictional local integration scenario",
  eventDates: {
    startsAt: "2026-07-27T00:00:00.000Z",
    endsAt: "2026-07-28T00:00:00.000Z",
  },
  venue: "Test Hall",
  tokensPerDollar: 10,
  supportLabel: "Test support",
  supportContact: "support@example.invalid",
  supportInstructions: "Use only for local automated tests.",
  updatedByAccountId: staffAccount.id,
  updatedAt: occurredAt,
};

function createCommand(
  overrides: Partial<CreateTokenIssuanceCommand> = {},
): CreateTokenIssuanceCommand {
  const content = new Blob(["local prototype evidence"], {
    type: "image/png",
  });

  return {
    actorAccountId: staffAccount.id,
    customerId: customer.id,
    paynowAmountCents: 1_055,
    evidence: {
      fileName: "manual-payment.png",
      mimeType: "image/png",
      sizeBytes: content.size,
      content,
      metadata: {
        source: "staff_provided",
        captureMode: "file_upload",
      },
    },
    paymentReference: "PN-NEW-001",
    note: "Payment was checked manually by event staff.",
    duplicatePaymentReferenceAcknowledged: false,
    idempotencyKey: "issuance:integration:001",
    ...overrides,
  };
}

interface DeterministicTransactionProviders {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly transactionGroupIdProvider: TransactionGroupIdProvider;
  readonly referenceProvider: TransactionReferenceProvider;
}

function createDeterministicProviders(): DeterministicTransactionProviders {
  let idSequence = 0;
  let groupSequence = 0;
  let referenceSequence = 0;

  return {
    clock: { now: () => occurredAt },
    idProvider: {
      generateId: (recordType) => {
        idSequence += 1;
        return `test-${recordType}-${idSequence}`;
      },
    },
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => {
        groupSequence += 1;
        return `transaction-issuance-integration-${groupSequence}`;
      },
    },
    referenceProvider: {
      generateReference: () => {
        referenceSequence += 1;
        return `ISS-INTEGRATION-${referenceSequence}`;
      },
    },
  };
}

let databaseSequence = 0;
let databaseName = "";
let repositories: LocalRepositories;

function createTransactionRunner(
  transform: (
    repositories: LocalRepositoryRegistry,
  ) => TokenIssuanceTransactionRepositories = (transactionRepositories) =>
    transactionRepositories,
): RepositoryTransactionRunner<TokenIssuanceTransactionRepositories> {
  return {
    run: <Result>(
      work: (
        transactionRepositories: TokenIssuanceTransactionRepositories,
      ) => Promise<Result>,
    ) =>
      runInLocalRepositoryTransaction(
        (transactionRepositories) => work(transform(transactionRepositories)),
        { databaseName },
      ),
  };
}

function createService(
  transactionRunner = createTransactionRunner(),
): TokenIssuanceService {
  return new TokenIssuanceService({
    transactionRunner,
    ...createDeterministicProviders(),
  });
}

beforeEach(async () => {
  databaseSequence += 1;
  databaseName = `tokenly-token-issuance-test-${databaseSequence}`;
  repositories = await createLocalRepositories({ databaseName });

  await repositories.accounts.create(
    staffAccount,
    createCredential(staffAccount.id),
  );
  await repositories.accounts.create(
    customerAccount,
    createCredential(customerAccount.id),
  );
  await repositories.wallets.create(wallet);
  await repositories.customers.create(customer);
  await repositories.eventSettings.save(settings);
});

afterEach(async () => {
  await repositories.close();
  await deleteDB(databaseName);
  await closeTokenlyDatabaseConnections();
});

describe("TokenIssuanceService IndexedDB integration", () => {
  it("atomically creates evidence, issuance, customer credit, and two audits", async () => {
    const service = createService();
    const receipt = await service.issue(createCommand());

    expect(receipt.previousBalance).toBe(0);
    expect(receipt.resultingBalance).toBe(105);
    expect(receipt.issuance).toMatchObject({
      paynowAmountCents: 1_055,
      tokensPerDollar: 10,
      tokenAmount: 105,
      normalizedPaymentReference: "pn-new-001",
      staffAccountId: staffAccount.id,
      customerId: customer.id,
      walletId: wallet.id,
    });
    expect(receipt.ledgerEntry).toMatchObject({
      direction: "credit",
      entryType: "token_issuance",
      tokenAmount: 105,
      actorAccountId: staffAccount.id,
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "issuance:integration:001",
      ),
    });
    expect(receipt.auditLogs.map(({ eventType }) => eventType)).toEqual([
      "evidence_attached",
      "token_issuance_created",
    ]);

    expect(await repositories.evidence.getById(receipt.evidence.id)).toEqual(
      receipt.evidence,
    );
    const storedContent = await repositories.evidence.getContentById(
      receipt.evidence.id,
    );
    await expect(storedContent?.text()).resolves.toBe(
      "local prototype evidence",
    );
    expect(
      await repositories.tokenIssuances.getById(receipt.issuance.id),
    ).toEqual(receipt.issuance);
    expect(
      await repositories.ledgerEntries.getById(receipt.ledgerEntry.id),
    ).toEqual(receipt.ledgerEntry);
    expect(
      await repositories.auditLogs.findByTransactionGroupId(
        receipt.issuance.transactionGroupId,
      ),
    ).toHaveLength(2);

    const entries = await repositories.ledgerEntries.findByWalletId(wallet.id);
    expect(calculateWalletBalance(entries)).toBe(105);
  });

  it("rejects a repeated idempotency key without duplicating records", async () => {
    const service = createService();
    const command = createCommand();

    await service.issue(command);
    await expect(service.issue(command)).rejects.toBeInstanceOf(
      DuplicateIdempotencyKeyError,
    );

    expect(await repositories.evidence.list()).toHaveLength(1);
    expect(await repositories.tokenIssuances.list()).toHaveLength(1);
    expect(await repositories.ledgerEntries.list()).toHaveLength(1);
    expect(await repositories.auditLogs.list()).toHaveLength(2);
  });

  it("rejects an operation key already reserved by another mutation type", async () => {
    await repositories.ledgerEntries.append({
      id: "ledger-cross-operation-reservation",
      walletId: wallet.id,
      transactionGroupId: "transaction-cross-operation-reservation",
      entryType: "administrative_adjustment",
      direction: "credit",
      tokenAmount: 1,
      actorAccountId: staffAccount.id,
      relatedCustomerId: null,
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: null,
      reference: "ADJ-CROSS-OPERATION",
      description: "Cross-operation idempotency reservation fixture.",
      occurredAt,
      idempotencyKey: createOperationLedgerIdempotencyKey(
        "issuance:integration:001",
      ),
      metadata: { source: "integration_test" },
      reversesLedgerEntryId: null,
    });
    const service = createService();

    await expect(service.issue(createCommand())).rejects.toBeInstanceOf(
      DuplicateIdempotencyKeyError,
    );

    expect(await repositories.evidence.list()).toEqual([]);
    expect(await repositories.tokenIssuances.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(await repositories.ledgerEntries.list()).toHaveLength(1);
  });

  it("requires and traces explicit acknowledgement of a duplicate payment reference", async () => {
    const service = createService();
    await service.issue(createCommand());

    const repeatedReferenceCommand = createCommand({
      paymentReference: "  pn-new-001  ",
      idempotencyKey: "issuance:integration:002",
    });

    await expect(
      service.issue(repeatedReferenceCommand),
    ).rejects.toBeInstanceOf(
      DuplicatePaymentReferenceAcknowledgementRequiredError,
    );

    const acknowledgedReceipt = await service.issue({
      ...repeatedReferenceCommand,
      duplicatePaymentReferenceAcknowledged: true,
    });

    expect(acknowledgedReceipt.duplicatePaymentReferenceAcknowledged).toBe(
      true,
    );
    expect(acknowledgedReceipt.auditLogs[1]?.metadata).toMatchObject({
      duplicatePaymentReferenceAcknowledged: true,
      matchingPaymentReferenceCount: 1,
    });
    expect(await repositories.tokenIssuances.list()).toHaveLength(2);
  });

  it("rolls back every record when an audit append fails", async () => {
    let auditAppendCount = 0;
    const failingRunner = createTransactionRunner(
      (transactionRepositories) => ({
        ...transactionRepositories,
        auditLogs: {
          append: async (entry) => {
            auditAppendCount += 1;
            if (auditAppendCount === 2) {
              throw new Error("simulated audit append failure");
            }
            await transactionRepositories.auditLogs.append(entry);
          },
        } satisfies Pick<AuditLogRepository, "append">,
      }),
    );
    const service = createService(failingRunner);

    await expect(service.issue(createCommand())).rejects.toThrow(
      "simulated audit append failure",
    );

    expect(await repositories.evidence.list()).toEqual([]);
    expect(await repositories.tokenIssuances.list()).toEqual([]);
    expect(await repositories.ledgerEntries.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
  });

  it("rejects a generated transaction-group collision before writing issuance records", async () => {
    await repositories.ledgerEntries.append({
      id: "ledger-existing-group",
      walletId: wallet.id,
      transactionGroupId: "transaction-issuance-integration-1",
      entryType: "administrative_adjustment",
      direction: "credit",
      tokenAmount: 1,
      actorAccountId: staffAccount.id,
      relatedCustomerId: null,
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: null,
      reference: "ADJ-EXISTING-GROUP",
      description: "Existing transaction-group collision fixture.",
      occurredAt,
      idempotencyKey: "existing:transaction:group",
      metadata: { source: "integration_test" },
      reversesLedgerEntryId: null,
    });
    const service = createService();

    await expect(service.issue(createCommand())).rejects.toBeInstanceOf(
      DuplicateTransactionGroupIdError,
    );

    expect(await repositories.evidence.list()).toEqual([]);
    expect(await repositories.tokenIssuances.list()).toEqual([]);
    expect(await repositories.auditLogs.list()).toEqual([]);
    expect(await repositories.ledgerEntries.list()).toHaveLength(1);
  });
});
