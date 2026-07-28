import type { AccountRepository } from "@/modules/accounts";
import type { CustomerRepository } from "@/modules/customers";
import type {
  EventSettings,
  EventSettingsRepository,
} from "@/modules/event-settings";
import type { Order, OrderRepository } from "@/modules/orders";
import type { Refund, RefundRepository } from "@/modules/refunds";
import type {
  TokenIssuance,
  TokenIssuanceRepository,
} from "@/modules/token-issuance";
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
import { domainIdSchema } from "@/shared/validation";

import type {
  CustomerEventReadModel,
  CustomerHomeReadModel,
  CustomerIdentityReadModel,
  CustomerIssuanceReadModel,
  CustomerOrderReadModel,
  CustomerRefundReadModel,
  CustomerTransactionDetailReadModel,
  CustomerTransactionHistoryReadModel,
  CustomerTransactionKind,
  CustomerTransactionListItem,
  CustomerWalletPageReadModel,
  CustomerWalletReadModel,
} from "./customer-portal-read-model";

const recentTransactionLimit = 4;

export interface CustomerPortalQueryRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
  readonly eventSettings: Pick<EventSettingsRepository, "get">;
  readonly ledgerEntries: Pick<
    LedgerEntryRepository,
    "findByTransactionGroupId" | "findByWalletId" | "getById"
  >;
  readonly orders: Pick<OrderRepository, "getById" | "getByTransactionGroupId">;
  readonly refunds: Pick<
    RefundRepository,
    "findByOrderId" | "getById" | "getByTransactionGroupId"
  >;
  readonly tokenIssuances: Pick<
    TokenIssuanceRepository,
    "getById" | "getByTransactionGroupId"
  >;
  readonly vendors: Pick<VendorRepository, "getById" | "list">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

export type CustomerPortalQueryTransactionRunner =
  RepositoryTransactionRunner<CustomerPortalQueryRepositories>;

export class CustomerPortalAccessDeniedError extends Error {
  public readonly code = "CUSTOMER_PORTAL_ACCESS_DENIED";

  public constructor() {
    super("The customer portal is unavailable for this account.");
    this.name = "CustomerPortalAccessDeniedError";
  }
}

export class CustomerPortalDataUnavailableError extends Error {
  public readonly code = "CUSTOMER_PORTAL_DATA_UNAVAILABLE";

  public constructor() {
    super("The customer wallet data is unavailable.");
    this.name = "CustomerPortalDataUnavailableError";
  }
}

export class CustomerTransactionNotFoundError extends Error {
  public readonly code = "CUSTOMER_TRANSACTION_NOT_FOUND";

  public constructor() {
    super("That customer transaction could not be found.");
    this.name = "CustomerTransactionNotFoundError";
  }
}

interface LoadedCustomerContext {
  readonly customer: CustomerIdentityReadModel;
  readonly wallet: Wallet;
}

interface LoadedCustomerSnapshot {
  readonly customer: CustomerIdentityReadModel;
  readonly event: CustomerEventReadModel;
  readonly entries: readonly LedgerEntry[];
  readonly transactions: readonly CustomerTransactionListItem[];
  readonly wallet: CustomerWalletReadModel;
}

interface ResolvedTransaction {
  readonly directIssuance: TokenIssuance | null;
  readonly directLedgerEntry: LedgerEntry | null;
  readonly directOrder: Order | null;
  readonly directRefund: Refund | null;
  readonly transactionGroupId: string;
}

function parseDomainId(value: unknown): string {
  const result = domainIdSchema.safeParse(value);
  if (!result.success) {
    throw new CustomerPortalAccessDeniedError();
  }

  return result.data;
}

function parseTransactionId(value: unknown): string {
  const result = domainIdSchema.safeParse(value);
  if (!result.success) {
    throw new CustomerTransactionNotFoundError();
  }

  return result.data;
}

function toEventReadModel(settings: EventSettings): CustomerEventReadModel {
  return Object.freeze({
    name: settings.eventName,
    subtitle: settings.eventSubtitle,
    venue: settings.venue,
    startsAt: settings.eventDates.startsAt,
    endsAt: settings.eventDates.endsAt,
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

function getTransactionTitle(
  kind: CustomerTransactionKind,
  vendorName: string | null,
): string {
  switch (kind) {
    case "issuance":
      return "Tokens added";
    case "purchase":
      return vendorName === null ? "Purchase" : `Purchase at ${vendorName}`;
    case "refund":
      return vendorName === null ? "Refund" : `Refund from ${vendorName}`;
    case "adjustment":
      return "Wallet adjustment";
    case "other":
      return "Wallet activity";
  }
}

function getTransactionSubtitle(
  entry: LedgerEntry,
  kind: CustomerTransactionKind,
): string {
  switch (kind) {
    case "issuance":
      return "Recorded manually by event staff";
    case "purchase":
      return "Completed order";
    case "refund":
      return "Tokens returned to your wallet";
    case "adjustment":
      return entry.description;
    case "other":
      return entry.description;
  }
}

function sortTransactions(
  transactions: readonly CustomerTransactionListItem[],
): readonly CustomerTransactionListItem[] {
  return Object.freeze(
    [...transactions].sort((left, right) => {
      const timestampDifference =
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
      return timestampDifference !== 0
        ? timestampDifference
        : right.id.localeCompare(left.id);
    }),
  );
}

function createTransactionListItem(
  entry: LedgerEntry,
  vendorsById: ReadonlyMap<string, Vendor>,
): CustomerTransactionListItem {
  const kind = getTransactionKind(entry.entryType);
  const vendor =
    entry.relatedVendorId === null
      ? null
      : (vendorsById.get(entry.relatedVendorId) ?? null);
  const transactionId =
    kind === "purchase" && entry.relatedOrderId !== null
      ? entry.relatedOrderId
      : entry.id;

  return Object.freeze({
    id: entry.id,
    transactionId,
    transactionGroupId: entry.transactionGroupId,
    kind,
    direction: entry.direction,
    tokenAmount: entry.tokenAmount,
    reference: entry.reference,
    occurredAt: entry.occurredAt,
    title: getTransactionTitle(kind, vendor?.displayName ?? null),
    subtitle: getTransactionSubtitle(entry, kind),
    vendorName: vendor?.displayName ?? null,
    orderId: entry.relatedOrderId,
  });
}

async function loadCustomerContext(
  actorAccountId: string,
  repositories: CustomerPortalQueryRepositories,
): Promise<LoadedCustomerContext> {
  const [account, customer] = await Promise.all([
    repositories.accounts.getById(actorAccountId),
    repositories.customers.getByAccountId(actorAccountId),
  ]);

  if (
    account === null ||
    account.id !== actorAccountId ||
    account.status !== "active" ||
    account.role !== "customer" ||
    customer === null ||
    customer.accountId !== account.id
  ) {
    throw new CustomerPortalAccessDeniedError();
  }

  const wallet = await repositories.wallets.getById(customer.walletId);
  if (
    wallet === null ||
    wallet.id !== customer.walletId ||
    wallet.ownerAccountId !== account.id ||
    wallet.ownerType !== "customer"
  ) {
    throw new CustomerPortalDataUnavailableError();
  }

  return Object.freeze({
    customer: Object.freeze({
      accountId: account.id,
      customerId: customer.id,
      displayName: account.displayName,
    }),
    wallet,
  });
}

async function loadCustomerSnapshot(
  actorAccountId: string,
  repositories: CustomerPortalQueryRepositories,
): Promise<LoadedCustomerSnapshot> {
  const context = await loadCustomerContext(actorAccountId, repositories);
  const [settings, entries, vendors] = await Promise.all([
    repositories.eventSettings.get(),
    repositories.ledgerEntries.findByWalletId(context.wallet.id),
    repositories.vendors.list(),
  ]);

  if (settings === null) {
    throw new CustomerPortalDataUnavailableError();
  }

  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const transactions = sortTransactions(
    entries.map((entry) => createTransactionListItem(entry, vendorsById)),
  );

  return Object.freeze({
    customer: context.customer,
    event: toEventReadModel(settings),
    entries,
    transactions,
    wallet: Object.freeze({
      id: context.wallet.id,
      balance: calculateWalletBalance(entries),
      status: context.wallet.status,
    }),
  });
}

function isOwnedOrder(
  order: Order | null,
  context: LoadedCustomerContext,
): order is Order {
  return (
    order !== null &&
    order.customerId === context.customer.customerId &&
    order.customerWalletId === context.wallet.id
  );
}

function isOwnedRefund(
  refund: Refund | null,
  context: LoadedCustomerContext,
): refund is Refund {
  return refund !== null && refund.customerId === context.customer.customerId;
}

function isOwnedIssuance(
  issuance: TokenIssuance | null,
  context: LoadedCustomerContext,
): issuance is TokenIssuance {
  return (
    issuance !== null &&
    issuance.customerId === context.customer.customerId &&
    issuance.walletId === context.wallet.id
  );
}

async function resolveTransaction(
  transactionId: string,
  context: LoadedCustomerContext,
  repositories: CustomerPortalQueryRepositories,
): Promise<ResolvedTransaction> {
  const [directOrder, directLedgerEntry, directRefund, directIssuance] =
    await Promise.all([
      repositories.orders.getById(transactionId),
      repositories.ledgerEntries.getById(transactionId),
      repositories.refunds.getById(transactionId),
      repositories.tokenIssuances.getById(transactionId),
    ]);

  const hasDirectRecord =
    directOrder !== null ||
    directLedgerEntry !== null ||
    directRefund !== null ||
    directIssuance !== null;
  const ownedDirectLedgerEntry =
    directLedgerEntry?.walletId === context.wallet.id
      ? directLedgerEntry
      : null;
  const ownedDirectOrder = isOwnedOrder(directOrder, context)
    ? directOrder
    : null;
  const ownedDirectRefund = isOwnedRefund(directRefund, context)
    ? directRefund
    : null;
  const ownedDirectIssuance = isOwnedIssuance(directIssuance, context)
    ? directIssuance
    : null;

  if (
    hasDirectRecord &&
    ownedDirectLedgerEntry === null &&
    ownedDirectOrder === null &&
    ownedDirectRefund === null &&
    ownedDirectIssuance === null
  ) {
    throw new CustomerTransactionNotFoundError();
  }

  const directTransactionGroupId =
    ownedDirectOrder?.transactionGroupId ??
    ownedDirectLedgerEntry?.transactionGroupId ??
    ownedDirectRefund?.transactionGroupId ??
    ownedDirectIssuance?.transactionGroupId;

  if (directTransactionGroupId !== undefined) {
    return Object.freeze({
      directIssuance: ownedDirectIssuance,
      directLedgerEntry: ownedDirectLedgerEntry,
      directOrder: ownedDirectOrder,
      directRefund: ownedDirectRefund,
      transactionGroupId: directTransactionGroupId,
    });
  }

  const [groupEntries, groupOrder, groupRefund, groupIssuance] =
    await Promise.all([
      repositories.ledgerEntries.findByTransactionGroupId(transactionId),
      repositories.orders.getByTransactionGroupId(transactionId),
      repositories.refunds.getByTransactionGroupId(transactionId),
      repositories.tokenIssuances.getByTransactionGroupId(transactionId),
    ]);
  const ownedGroupEntry =
    groupEntries.find((entry) => entry.walletId === context.wallet.id) ?? null;
  const ownedGroupOrder = isOwnedOrder(groupOrder, context) ? groupOrder : null;
  const ownedGroupRefund = isOwnedRefund(groupRefund, context)
    ? groupRefund
    : null;
  const ownedGroupIssuance = isOwnedIssuance(groupIssuance, context)
    ? groupIssuance
    : null;

  if (
    ownedGroupEntry === null &&
    ownedGroupOrder === null &&
    ownedGroupRefund === null &&
    ownedGroupIssuance === null
  ) {
    throw new CustomerTransactionNotFoundError();
  }

  return Object.freeze({
    directIssuance: ownedGroupIssuance,
    directLedgerEntry: ownedGroupEntry,
    directOrder: ownedGroupOrder,
    directRefund: ownedGroupRefund,
    transactionGroupId: transactionId,
  });
}

function selectPrimaryLedgerEntry(
  entries: readonly LedgerEntry[],
  resolved: ResolvedTransaction,
  walletId: string,
): LedgerEntry | null {
  if (resolved.directLedgerEntry?.walletId === walletId) {
    return resolved.directLedgerEntry;
  }

  const walletEntries = entries.filter((entry) => entry.walletId === walletId);

  if (resolved.directOrder !== null) {
    return (
      walletEntries.find((entry) => entry.entryType === "customer_purchase") ??
      null
    );
  }

  if (resolved.directRefund !== null) {
    return (
      walletEntries.find((entry) => entry.entryType === "customer_refund") ??
      null
    );
  }

  if (resolved.directIssuance !== null) {
    return (
      walletEntries.find((entry) => entry.entryType === "token_issuance") ??
      null
    );
  }

  return walletEntries[0] ?? null;
}

function toRefundReadModel(refund: Refund): CustomerRefundReadModel {
  return Object.freeze({
    id: refund.id,
    reference: refund.reference,
    tokenAmount: refund.tokenAmount,
    reason: refund.reason,
    createdAt: refund.createdAt,
  });
}

function toOrderReadModel(
  order: Order,
  refunds: readonly Refund[],
): CustomerOrderReadModel {
  const refundedTokenAmount = refunds.reduce(
    (total, refund) => total + refund.tokenAmount,
    0,
  );

  if (!Number.isSafeInteger(refundedTokenAmount)) {
    throw new CustomerPortalDataUnavailableError();
  }

  return Object.freeze({
    id: order.id,
    reference: order.reference,
    completedAt: order.completedAt,
    tokenTotal: order.tokenTotal,
    items: Object.freeze(
      order.items.map((item) =>
        Object.freeze({
          productId: item.productId,
          productName: item.productName,
          unitTokenPrice: item.unitTokenPrice,
          quantity: item.quantity,
          lineTokenTotal: item.lineTokenTotal,
        }),
      ),
    ),
    refundedTokenAmount,
  });
}

function toIssuanceReadModel(
  issuance: TokenIssuance,
): CustomerIssuanceReadModel {
  return Object.freeze({
    reference: issuance.reference,
    paynowAmountCents: issuance.paynowAmountCents,
    tokensPerDollar: issuance.tokensPerDollar,
    tokenAmount: issuance.tokenAmount,
    paymentReference: issuance.paymentReference,
    note: issuance.note,
    createdAt: issuance.createdAt,
  });
}

async function loadTransactionDetail(
  transactionId: string,
  context: LoadedCustomerContext,
  repositories: CustomerPortalQueryRepositories,
): Promise<CustomerTransactionDetailReadModel> {
  const resolved = await resolveTransaction(
    transactionId,
    context,
    repositories,
  );
  const groupEntries =
    await repositories.ledgerEntries.findByTransactionGroupId(
      resolved.transactionGroupId,
    );
  const primaryEntry = selectPrimaryLedgerEntry(
    groupEntries,
    resolved,
    context.wallet.id,
  );

  if (primaryEntry === null) {
    throw new CustomerPortalDataUnavailableError();
  }

  const groupOrder =
    resolved.directOrder ??
    (await repositories.orders.getByTransactionGroupId(
      resolved.transactionGroupId,
    ));
  const groupRefund =
    resolved.directRefund ??
    (await repositories.refunds.getByTransactionGroupId(
      resolved.transactionGroupId,
    ));
  const groupIssuance =
    resolved.directIssuance ??
    (await repositories.tokenIssuances.getByTransactionGroupId(
      resolved.transactionGroupId,
    ));
  const orderId =
    primaryEntry.relatedOrderId ?? groupRefund?.orderId ?? groupOrder?.id;
  const order =
    groupOrder ??
    (orderId === undefined ? null : await repositories.orders.getById(orderId));

  if (order !== null && !isOwnedOrder(order, context)) {
    throw new CustomerTransactionNotFoundError();
  }

  if (groupRefund !== null && !isOwnedRefund(groupRefund, context)) {
    throw new CustomerTransactionNotFoundError();
  }

  if (groupIssuance !== null && !isOwnedIssuance(groupIssuance, context)) {
    throw new CustomerTransactionNotFoundError();
  }

  const refunds =
    order === null ? [] : await repositories.refunds.findByOrderId(order.id);
  if (
    refunds.some((refund) => refund.customerId !== context.customer.customerId)
  ) {
    throw new CustomerPortalDataUnavailableError();
  }

  const vendorId =
    order?.vendorId ?? groupRefund?.vendorId ?? primaryEntry.relatedVendorId;
  const vendor =
    vendorId === null || vendorId === undefined
      ? null
      : await repositories.vendors.getById(vendorId);
  const kind = getTransactionKind(primaryEntry.entryType);
  const sortedRefunds = Object.freeze(
    [...refunds].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    ),
  );

  return Object.freeze({
    id: primaryEntry.id,
    transactionGroupId: resolved.transactionGroupId,
    kind,
    direction: primaryEntry.direction,
    tokenAmount: primaryEntry.tokenAmount,
    reference:
      resolved.directRefund?.reference ??
      resolved.directOrder?.reference ??
      primaryEntry.reference,
    occurredAt:
      resolved.directRefund?.createdAt ??
      resolved.directOrder?.completedAt ??
      primaryEntry.occurredAt,
    title: getTransactionTitle(kind, vendor?.displayName ?? null),
    description: primaryEntry.description,
    vendorName: vendor?.displayName ?? null,
    order: order === null ? null : toOrderReadModel(order, sortedRefunds),
    refunds: Object.freeze(sortedRefunds.map(toRefundReadModel)),
    selectedRefundId: resolved.directRefund?.id ?? null,
    issuance:
      groupIssuance === null ? null : toIssuanceReadModel(groupIssuance),
  });
}

export class CustomerPortalQuery {
  public constructor(
    private readonly transactionRunner: CustomerPortalQueryTransactionRunner,
  ) {}

  public getHome(actorAccountId: unknown): Promise<CustomerHomeReadModel> {
    const parsedActorAccountId = parseDomainId(actorAccountId);

    return this.transactionRunner.run(async (repositories) => {
      const snapshot = await loadCustomerSnapshot(
        parsedActorAccountId,
        repositories,
      );

      return Object.freeze({
        event: snapshot.event,
        customer: snapshot.customer,
        wallet: snapshot.wallet,
        recentTransactions: Object.freeze(
          snapshot.transactions.slice(0, recentTransactionLimit),
        ),
      });
    });
  }

  public getWallet(
    actorAccountId: unknown,
  ): Promise<CustomerWalletPageReadModel> {
    const parsedActorAccountId = parseDomainId(actorAccountId);

    return this.transactionRunner.run(async (repositories) => {
      const snapshot = await loadCustomerSnapshot(
        parsedActorAccountId,
        repositories,
      );

      return Object.freeze({
        customer: snapshot.customer,
        wallet: snapshot.wallet,
        transactions: snapshot.transactions,
      });
    });
  }

  public listTransactions(
    actorAccountId: unknown,
  ): Promise<CustomerTransactionHistoryReadModel> {
    const parsedActorAccountId = parseDomainId(actorAccountId);

    return this.transactionRunner.run(async (repositories) => {
      const snapshot = await loadCustomerSnapshot(
        parsedActorAccountId,
        repositories,
      );

      return Object.freeze({
        customer: snapshot.customer,
        transactions: snapshot.transactions,
      });
    });
  }

  public getTransactionDetail(
    actorAccountId: unknown,
    transactionId: unknown,
  ): Promise<CustomerTransactionDetailReadModel> {
    const parsedActorAccountId = parseDomainId(actorAccountId);
    const parsedTransactionId = parseTransactionId(transactionId);

    return this.transactionRunner.run(async (repositories) => {
      const context = await loadCustomerContext(
        parsedActorAccountId,
        repositories,
      );
      return loadTransactionDetail(parsedTransactionId, context, repositories);
    });
  }
}
