import { describe, expect, it } from "vitest";

import type { Account } from "@/modules/accounts";
import type { AuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type { EventSettings } from "@/modules/event-settings";
import type { Evidence } from "@/modules/evidence";
import {
  InvalidTokenAmountError,
  NegativeWalletBalanceError,
  type LedgerEntry,
  type TransactionIdProvider,
} from "@/modules/transactions";
import type { Wallet } from "@/modules/wallets";

import {
  TokenIssuanceService,
  type TokenIssuanceTransactionRepositories,
} from "./create-token-issuance";
import type { CreateTokenIssuanceCommand } from "./create-token-issuance-schema";
import {
  TokenIssuanceEvidenceValidationError,
  type TokenIssuanceErrorCode,
} from "./token-issuance-errors";
import type { TokenIssuance } from "./token-issuance";

const occurredAt = "2026-07-27T06:00:00.000Z";

const staffAccount: Account = {
  id: "account-staff-issuance-unit",
  mobileNumber: "93333333",
  displayName: "Issuance Unit Staff",
  role: "staff",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customerAccount: Account = {
  id: "account-customer-issuance-unit",
  mobileNumber: "91111111",
  displayName: "Issuance Unit Customer",
  role: "customer",
  status: "active",
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const customer: Customer = {
  id: "customer-issuance-unit",
  accountId: customerAccount.id,
  walletId: "wallet-customer-issuance-unit",
  publicCode: "cus_ISSUANCE_UNIT",
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
  id: "event-settings-issuance-unit",
  eventName: "Tokenly Issuance Unit Test",
  eventSubtitle: "Fictional service harness",
  eventDates: {
    startsAt: "2026-07-27T00:00:00.000Z",
    endsAt: "2026-07-28T00:00:00.000Z",
  },
  venue: "Unit Hall",
  tokensPerDollar: 10,
  supportLabel: "Unit support",
  supportContact: "support@example.invalid",
  supportInstructions: "Use only for local unit tests.",
  updatedByAccountId: staffAccount.id,
  updatedAt: occurredAt,
};

function createCommand(): CreateTokenIssuanceCommand {
  const content = new Blob(["unit evidence"], { type: "image/png" });

  return {
    actorAccountId: staffAccount.id,
    customerId: customer.id,
    paynowAmountCents: 500,
    evidence: {
      fileName: "unit-evidence.png",
      mimeType: "image/png",
      sizeBytes: content.size,
      content,
      metadata: {
        source: "staff_provided",
        captureMode: "file_upload",
      },
    },
    paymentReference: "PN-UNIT-001",
    note: null,
    duplicatePaymentReferenceAcknowledged: false,
    idempotencyKey: "issuance:unit:001",
  };
}

interface IssuanceHarnessOptions {
  readonly customer?: Customer | null;
  readonly customerAccount?: Account | null;
  readonly ledgerEntries?: readonly LedgerEntry[];
  readonly settings?: EventSettings | null;
  readonly staffAccount?: Account | null;
  readonly wallet?: Wallet | null;
}

interface IssuanceHarness {
  readonly auditLogs: AuditLog[];
  readonly evidence: Evidence[];
  readonly issuances: TokenIssuance[];
  readonly ledgerEntries: LedgerEntry[];
  readonly service: TokenIssuanceService;
  readonly transactionRunCount: () => number;
}

function createIdProvider(): TransactionIdProvider {
  const counts = new Map<string, number>();

  return {
    generateId: (recordType) => {
      const count = (counts.get(recordType) ?? 0) + 1;
      counts.set(recordType, count);
      return `${recordType}-issuance-unit-${count}`;
    },
  };
}

function createHarness(options: IssuanceHarnessOptions = {}): IssuanceHarness {
  const resolvedStaff =
    options.staffAccount === undefined ? staffAccount : options.staffAccount;
  const resolvedCustomer =
    options.customer === undefined ? customer : options.customer;
  const resolvedCustomerAccount =
    options.customerAccount === undefined
      ? customerAccount
      : options.customerAccount;
  const resolvedWallet = options.wallet === undefined ? wallet : options.wallet;
  const resolvedSettings =
    options.settings === undefined ? settings : options.settings;
  const accounts = new Map<string, Account>();

  if (resolvedStaff !== null) {
    accounts.set(resolvedStaff.id, resolvedStaff);
  }
  if (resolvedCustomerAccount !== null) {
    accounts.set(resolvedCustomerAccount.id, resolvedCustomerAccount);
  }

  const auditLogs: AuditLog[] = [];
  const evidence: Evidence[] = [];
  const issuances: TokenIssuance[] = [];
  const ledgerEntries = [...(options.ledgerEntries ?? [])];
  let transactionRunCount = 0;

  const repositories: TokenIssuanceTransactionRepositories = {
    accounts: {
      getById: async (id) => accounts.get(id) ?? null,
    },
    auditLogs: {
      append: async (entry) => {
        auditLogs.push(entry);
      },
    },
    customers: {
      getById: async (id) =>
        resolvedCustomer?.id === id ? resolvedCustomer : null,
    },
    eventSettings: {
      get: async () => resolvedSettings,
    },
    evidence: {
      create: async (entry) => {
        evidence.push(entry);
      },
    },
    ledgerEntries: {
      append: async (entry) => {
        ledgerEntries.push(entry);
      },
      findByTransactionGroupId: async (transactionGroupId) =>
        ledgerEntries.filter(
          (entry) => entry.transactionGroupId === transactionGroupId,
        ),
      findByWalletId: async (walletId) =>
        ledgerEntries.filter((entry) => entry.walletId === walletId),
      getByIdempotencyKey: async (idempotencyKey) =>
        ledgerEntries.find(
          (entry) => entry.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    tokenIssuances: {
      create: async (issuance) => {
        issuances.push(issuance);
      },
      findByNormalizedPaymentReference: async (reference) =>
        issuances.filter(
          (issuance) => issuance.normalizedPaymentReference === reference,
        ),
      getByIdempotencyKey: async (idempotencyKey) =>
        issuances.find(
          (issuance) => issuance.idempotencyKey === idempotencyKey,
        ) ?? null,
    },
    wallets: {
      getById: async (id) =>
        resolvedWallet?.id === id ? resolvedWallet : null,
    },
  };
  const service = new TokenIssuanceService({
    transactionRunner: {
      run: async (work) => {
        transactionRunCount += 1;
        return work(repositories);
      },
    },
    clock: { now: () => occurredAt },
    idProvider: createIdProvider(),
    transactionGroupIdProvider: {
      generateTransactionGroupId: () => "transaction-issuance-unit-new",
    },
    referenceProvider: {
      generateReference: () => "ISS-UNIT-NEW",
    },
  });

  return {
    auditLogs,
    evidence,
    issuances,
    ledgerEntries,
    service,
    transactionRunCount: () => transactionRunCount,
  };
}

async function expectIssuanceCode(
  promise: Promise<unknown>,
  code: TokenIssuanceErrorCode,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("TokenIssuanceService authoritative validation", () => {
  it.each([
    {
      name: "missing",
      actor: null,
      code: "TOKEN_ISSUANCE_STAFF_ACCOUNT_NOT_FOUND",
    },
    {
      name: "disabled",
      actor: { ...staffAccount, status: "disabled" },
      code: "TOKEN_ISSUANCE_STAFF_ACCOUNT_INACTIVE",
    },
    {
      name: "wrong role",
      actor: { ...staffAccount, role: "administrator" },
      code: "TOKEN_ISSUANCE_STAFF_ROLE_REQUIRED",
    },
  ] as const)("rejects a $name staff actor", async ({ actor, code }) => {
    const harness = createHarness({ staffAccount: actor });

    await expectIssuanceCode(harness.service.issue(createCommand()), code);
    expect(harness.issuances).toEqual([]);
    expect(harness.ledgerEntries).toEqual([]);
  });

  it("rejects a customer profile backed by the wrong account role", async () => {
    const harness = createHarness({
      customerAccount: { ...customerAccount, role: "vendor" },
    });

    await expectIssuanceCode(
      harness.service.issue(createCommand()),
      "TOKEN_ISSUANCE_CUSTOMER_ACCOUNT_MISMATCH",
    );
    expect(harness.evidence).toEqual([]);
  });

  it("rejects a wallet whose authoritative owner does not match the customer", async () => {
    const harness = createHarness({
      wallet: { ...wallet, ownerAccountId: "account-other-customer" },
    });

    await expectIssuanceCode(
      harness.service.issue(createCommand()),
      "TOKEN_ISSUANCE_WALLET_OWNERSHIP_MISMATCH",
    );
    expect(harness.issuances).toEqual([]);
  });

  it("rejects tampered fractional ledger data without writing value", async () => {
    const tamperedEntry = {
      id: "ledger-tampered-unit",
      walletId: wallet.id,
      transactionGroupId: "transaction-tampered-unit",
      entryType: "token_issuance",
      direction: "credit",
      tokenAmount: 1.5,
      actorAccountId: staffAccount.id,
      relatedCustomerId: customer.id,
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: "evidence-tampered-unit",
      reference: "ISS-TAMPERED",
      description: "Tampered unit-test entry.",
      occurredAt,
      idempotencyKey: "tampered:ledger:unit",
      metadata: {},
      reversesLedgerEntryId: null,
    } as LedgerEntry;
    const harness = createHarness({ ledgerEntries: [tamperedEntry] });

    await expect(harness.service.issue(createCommand())).rejects.toBeInstanceOf(
      InvalidTokenAmountError,
    );
    expect(harness.ledgerEntries).toEqual([tamperedEntry]);
    expect(harness.auditLogs).toEqual([]);
  });

  it("rejects a tampered negative existing balance", async () => {
    const debitEntry: LedgerEntry = {
      id: "ledger-negative-unit",
      walletId: wallet.id,
      transactionGroupId: "transaction-negative-unit",
      entryType: "administrative_adjustment",
      direction: "debit",
      tokenAmount: 1,
      actorAccountId: "account-admin-unit",
      relatedCustomerId: null,
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: null,
      reference: "ADJ-NEGATIVE",
      description: "Negative balance tamper fixture.",
      occurredAt,
      idempotencyKey: "negative:ledger:unit",
      metadata: {},
      reversesLedgerEntryId: null,
    };
    const harness = createHarness({ ledgerEntries: [debitEntry] });

    await expect(harness.service.issue(createCommand())).rejects.toBeInstanceOf(
      NegativeWalletBalanceError,
    );
    expect(harness.issuances).toEqual([]);
  });

  it("rejects mismatched evidence bytes before opening a transaction", async () => {
    const harness = createHarness();
    const command = createCommand();

    await expect(
      harness.service.issue({
        ...command,
        evidence: {
          ...command.evidence,
          sizeBytes: command.evidence.sizeBytes + 1,
        },
      }),
    ).rejects.toBeInstanceOf(TokenIssuanceEvidenceValidationError);
    expect(harness.transactionRunCount()).toBe(0);
  });
});
