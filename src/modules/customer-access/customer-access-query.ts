import type { AccountRepository } from "@/modules/accounts";
import type { AuditLogRepository } from "@/modules/audit-logs";
import type { Customer, CustomerRepository } from "@/modules/customers";
import {
  type CustomerTransactionListItem,
  type CustomerTransactionKind,
} from "@/modules/customer-application";
import type {
  LedgerEntry,
  LedgerEntryRepository,
  RepositoryTransactionRunner,
} from "@/modules/transactions";
import type { Vendor, VendorRepository } from "@/modules/vendors";
import {
  calculateWalletBalance,
  type Wallet,
  type WalletRepository,
} from "@/modules/wallets";
import { domainIdSchema, publicCodeSchema } from "@/shared/validation";

import {
  buildClaimPath,
  buildPrivateAccountPath,
} from "./customer-access-code";
import type {
  AdminTokenerAccessSummary,
  AdminTokenerTransactionItem,
  PrivateAccountReadModel,
} from "./customer-access-read-model";
import { buildTokenlyQrPayload } from "@/modules/qr-payments";

export interface CustomerAccessQueryRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly customers: Pick<CustomerRepository, "getById" | "list">;
  readonly ledgerEntries: Pick<LedgerEntryRepository, "findByWalletId">;
  readonly vendors: Pick<VendorRepository, "list">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export interface CustomerAccessMutationRepositories extends CustomerAccessQueryRepositories {
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getById" | "list" | "update">;
}

export type CustomerAccessQueryTransactionRunner =
  RepositoryTransactionRunner<CustomerAccessQueryRepositories>;

export type CustomerAccessMutationTransactionRunner =
  RepositoryTransactionRunner<CustomerAccessMutationRepositories>;

export class CustomerAccessDeniedError extends Error {
  public readonly code = "CUSTOMER_ACCESS_DENIED";

  public constructor() {
    super("This Tokenly account link is unavailable.");
    this.name = "CustomerAccessDeniedError";
  }
}

export class AdminCustomerAccessDeniedError extends Error {
  public readonly code = "ADMIN_CUSTOMER_ACCESS_DENIED";

  public constructor() {
    super("The current account cannot manage tokener access.");
    this.name = "AdminCustomerAccessDeniedError";
  }
}

export class CustomerAccessDataUnavailableError extends Error {
  public readonly code = "CUSTOMER_ACCESS_DATA_UNAVAILABLE";

  public constructor() {
    super("Tokener access data is unavailable.");
    this.name = "CustomerAccessDataUnavailableError";
  }
}

function parseDomainId(value: unknown): string {
  const parsed = domainIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new AdminCustomerAccessDeniedError();
  }

  return parsed.data;
}

function parseAccessCode(value: unknown): string {
  const parsed = publicCodeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CustomerAccessDeniedError();
  }

  return parsed.data;
}

function requireAccessCredentials(customer: Customer): {
  readonly claimCode: string;
  readonly claimExpiresAt: string;
  readonly claimedAt: string | null;
  readonly privateAccessCode: string;
  readonly walletQrUpdatedAt: string;
} {
  if (
    customer.privateAccessCode === undefined ||
    customer.claimCode === undefined ||
    customer.claimExpiresAt === undefined ||
    customer.walletQrUpdatedAt === undefined
  ) {
    throw new CustomerAccessDataUnavailableError();
  }

  return Object.freeze({
    claimCode: customer.claimCode,
    claimExpiresAt: customer.claimExpiresAt,
    claimedAt: customer.claimedAt ?? null,
    privateAccessCode: customer.privateAccessCode,
    walletQrUpdatedAt: customer.walletQrUpdatedAt,
  });
}

async function assertAdministrator(
  actorAccountId: string,
  repositories: Pick<CustomerAccessQueryRepositories, "accounts">,
): Promise<void> {
  const account = await repositories.accounts.getById(actorAccountId);

  if (
    account === null ||
    account.status !== "active" ||
    account.role !== "administrator"
  ) {
    throw new AdminCustomerAccessDeniedError();
  }
}

async function loadWalletSnapshot(
  customer: Customer,
  repositories: Pick<
    CustomerAccessQueryRepositories,
    "ledgerEntries" | "wallets"
  >,
): Promise<{
  readonly balance: number;
  readonly entries: readonly LedgerEntry[];
  readonly wallet: Wallet;
}> {
  const wallet = await repositories.wallets.getById(customer.walletId);
  if (
    wallet === null ||
    wallet.ownerAccountId !== customer.accountId ||
    wallet.ownerType !== "customer"
  ) {
    throw new CustomerAccessDataUnavailableError();
  }

  const entries = await repositories.ledgerEntries.findByWalletId(wallet.id);
  return Object.freeze({
    balance: calculateWalletBalance(entries),
    entries,
    wallet,
  });
}

function toAdminTokenerTransactionItems(
  entries: readonly LedgerEntry[],
  vendorsById: ReadonlyMap<string, Vendor>,
): readonly AdminTokenerTransactionItem[] {
  const refundedByPurchaseEntryId = new Map<string, number>();

  for (const entry of entries) {
    if (
      entry.entryType === "customer_refund" &&
      entry.direction === "credit" &&
      entry.reversesLedgerEntryId !== null
    ) {
      refundedByPurchaseEntryId.set(
        entry.reversesLedgerEntryId,
        (refundedByPurchaseEntryId.get(entry.reversesLedgerEntryId) ?? 0) +
          entry.tokenAmount,
      );
    }
  }

  return Object.freeze(
    entries
      .map((entry): AdminTokenerTransactionItem => {
        const vendor =
          entry.relatedVendorId === null
            ? null
            : (vendorsById.get(entry.relatedVendorId) ?? null);
        const refundedTokenAmount =
          refundedByPurchaseEntryId.get(entry.id) ?? 0;
        const refundableTokenAmount =
          entry.entryType === "customer_purchase" && entry.direction === "debit"
            ? Math.max(0, entry.tokenAmount - refundedTokenAmount)
            : 0;

        return {
          description: entry.description,
          direction: entry.direction,
          entryType: entry.entryType,
          id: entry.id,
          occurredAt: entry.occurredAt,
          reference: entry.reference,
          refundableTokenAmount,
          title:
            entry.entryType === "customer_purchase"
              ? "Vendor charge"
              : entry.entryType === "customer_refund"
                ? "Admin refund"
                : entry.entryType === "token_issuance"
                  ? "Credit issuance"
                  : "Wallet activity",
          tokenAmount: entry.tokenAmount,
          transactionGroupId: entry.transactionGroupId,
          vendorName: vendor?.displayName ?? null,
          vendorUsername: null,
        };
      })
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      ),
  );
}

async function toAdminSummary(
  customer: Customer,
  repositories: CustomerAccessQueryRepositories,
): Promise<AdminTokenerAccessSummary> {
  const credentials = requireAccessCredentials(customer);
  const account = await repositories.accounts.getById(customer.accountId);
  if (account === null) {
    throw new CustomerAccessDataUnavailableError();
  }

  const [{ balance, entries }, vendors] = await Promise.all([
    loadWalletSnapshot(customer, repositories),
    repositories.vendors.list(),
  ]);
  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  return Object.freeze({
    customerId: customer.id,
    displayName: account.displayName,
    balance,
    claimPath: buildClaimPath(credentials.claimCode),
    claimExpiresAt: credentials.claimExpiresAt,
    claimedAt: credentials.claimedAt,
    transactions: toAdminTokenerTransactionItems(entries, vendorsById),
    walletPublicCode: customer.publicCode,
    walletQrUpdatedAt: credentials.walletQrUpdatedAt,
  });
}

function getTransactionKind(
  entryType: LedgerEntry["entryType"],
): CustomerTransactionKind {
  switch (entryType) {
    case "token_issuance":
      return "issuance";
    case "customer_purchase":
      return "purchase";
    case "customer_refund":
      return "refund";
    case "administrative_adjustment":
      return "adjustment";
    default:
      return "other";
  }
}

function toTransactionItem(
  entry: LedgerEntry,
  vendorsById: ReadonlyMap<string, Vendor>,
): CustomerTransactionListItem {
  const kind = getTransactionKind(entry.entryType);
  const vendor =
    entry.relatedVendorId === null
      ? null
      : (vendorsById.get(entry.relatedVendorId) ?? null);
  const title =
    kind === "issuance"
      ? "Tokens added"
      : kind === "purchase"
        ? vendor === null
          ? "Purchase"
          : `Purchase at ${vendor.displayName}`
        : kind === "refund"
          ? "Refund received"
          : "Wallet activity";

  return Object.freeze({
    id: entry.id,
    transactionId: entry.relatedOrderId ?? entry.id,
    transactionGroupId: entry.transactionGroupId,
    kind,
    direction: entry.direction,
    tokenAmount: entry.tokenAmount,
    reference: entry.reference,
    occurredAt: entry.occurredAt,
    title,
    subtitle: entry.description,
    vendorName: vendor?.displayName ?? null,
    orderId: entry.relatedOrderId,
  });
}

export class CustomerAccessQuery {
  public constructor(
    private readonly transactionRunner: CustomerAccessQueryTransactionRunner,
  ) {}

  public listForAdmin(
    actorAccountIdInput: unknown,
  ): Promise<readonly AdminTokenerAccessSummary[]> {
    const actorAccountId = parseDomainId(actorAccountIdInput);

    return this.transactionRunner.run(async (repositories) => {
      await assertAdministrator(actorAccountId, repositories);
      const customers = await repositories.customers.list();
      const summaries = await Promise.all(
        customers.map((customer) => toAdminSummary(customer, repositories)),
      );

      return Object.freeze(
        summaries.sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
      );
    });
  }

  public getAdminDetail(
    actorAccountIdInput: unknown,
    customerIdInput: unknown,
  ): Promise<AdminTokenerAccessSummary> {
    const actorAccountId = parseDomainId(actorAccountIdInput);
    const customerId = domainIdSchema.parse(customerIdInput);

    return this.transactionRunner.run(async (repositories) => {
      await assertAdministrator(actorAccountId, repositories);
      const customer = await repositories.customers.getById(customerId);

      if (customer === null) {
        throw new CustomerAccessDataUnavailableError();
      }

      return toAdminSummary(customer, repositories);
    });
  }

  public getPrivateAccount(
    privateAccessCodeInput: unknown,
  ): Promise<PrivateAccountReadModel> {
    const privateAccessCode = parseAccessCode(privateAccessCodeInput);

    return this.transactionRunner.run(async (repositories) => {
      const customers = await repositories.customers.list();
      const customer =
        customers.find(
          (candidate) => candidate.privateAccessCode === privateAccessCode,
        ) ?? null;

      if (customer === null) {
        throw new CustomerAccessDeniedError();
      }
      const credentials = requireAccessCredentials(customer);

      const account = await repositories.accounts.getById(customer.accountId);
      if (account === null || account.status !== "active") {
        throw new CustomerAccessDeniedError();
      }

      const wallet = await repositories.wallets.getById(customer.walletId);
      if (wallet === null || wallet.ownerAccountId !== account.id) {
        throw new CustomerAccessDataUnavailableError();
      }

      const [entries, vendors] = await Promise.all([
        repositories.ledgerEntries.findByWalletId(wallet.id),
        repositories.vendors.list(),
      ]);
      const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
      const transactions = entries
        .map((entry) => toTransactionItem(entry, vendorsById))
        .sort(
          (left, right) =>
            Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
        );

      return Object.freeze({
        customerId: customer.id,
        displayName: account.displayName,
        balance: calculateWalletBalance(entries),
        walletStatus: wallet.status,
        privateAccountPath: buildPrivateAccountPath(
          credentials.privateAccessCode,
        ),
        walletPublicCode: customer.publicCode,
        walletQrPayload: buildTokenlyQrPayload({
          version: 1,
          kind: "customer",
          publicCode: customer.publicCode,
        }),
        walletQrUpdatedAt: credentials.walletQrUpdatedAt,
        transactions: Object.freeze(transactions.slice(0, 8)),
      });
    });
  }
}

export { assertAdministrator };
export { requireAccessCredentials };
