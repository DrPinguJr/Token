import {
  deleteDB,
  openDB,
  unwrap,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from "idb";

export const TOKENLY_DATABASE_NAME = "tokenly-local-prototype";
export const TOKENLY_DATABASE_SCHEMA_VERSION = 1;
export const TOKENLY_DATA_VERSION = 2;

export const tokenlyStoreNames = {
  accountPinCredentials: "accountPinCredentials",
  accounts: "accounts",
  auditLogs: "auditLogs",
  customers: "customers",
  dataMetadata: "dataMetadata",
  evidence: "evidence",
  evidenceContents: "evidenceContents",
  eventSettings: "eventSettings",
  ledgerEntries: "ledgerEntries",
  orders: "orders",
  products: "products",
  refunds: "refunds",
  settlements: "settlements",
  tokenIssuances: "tokenIssuances",
  vendors: "vendors",
  wallets: "wallets",
} as const;

export const tokenlyIndexNames = {
  accounts: {
    mobileNumber: "by-mobile-number",
    role: "by-role",
    status: "by-status",
  },
  auditLogs: {
    actorAccountId: "by-actor-account-id",
    eventType: "by-event-type",
    occurredAt: "by-occurred-at",
    target: "by-target",
    transactionGroupId: "by-transaction-group-id",
  },
  customers: {
    accountId: "by-account-id",
    publicCode: "by-public-code",
    walletId: "by-wallet-id",
  },
  evidence: {
    capturedByAccountId: "by-captured-by-account-id",
    createdAt: "by-created-at",
  },
  ledgerEntries: {
    idempotencyKey: "by-idempotency-key",
    occurredAt: "by-occurred-at",
    relatedOrderId: "by-related-order-id",
    transactionGroupId: "by-transaction-group-id",
    walletAndIdempotencyKey: "by-wallet-and-idempotency-key",
    walletId: "by-wallet-id",
  },
  orders: {
    completedAt: "by-completed-at",
    customerAndCompletedAt: "by-customer-and-completed-at",
    customerId: "by-customer-id",
    idempotencyKey: "by-idempotency-key",
    reference: "by-reference",
    transactionGroupId: "by-transaction-group-id",
    vendorAndCompletedAt: "by-vendor-and-completed-at",
    vendorId: "by-vendor-id",
  },
  products: {
    vendorAndArchived: "by-vendor-and-archived",
    vendorAndAvailability: "by-vendor-and-availability",
    vendorAndDisplayOrder: "by-vendor-and-display-order",
    vendorAndSoldOut: "by-vendor-and-sold-out",
    vendorId: "by-vendor-id",
  },
  refunds: {
    createdAt: "by-created-at",
    idempotencyKey: "by-idempotency-key",
    orderAndCreatedAt: "by-order-and-created-at",
    orderId: "by-order-id",
    reference: "by-reference",
    transactionGroupId: "by-transaction-group-id",
  },
  settlements: {
    reference: "by-reference",
    status: "by-status",
    vendorAndPeriod: "by-vendor-and-period",
    vendorId: "by-vendor-id",
  },
  tokenIssuances: {
    createdAt: "by-created-at",
    customerAndCreatedAt: "by-customer-and-created-at",
    customerId: "by-customer-id",
    idempotencyKey: "by-idempotency-key",
    normalizedPaymentReference: "by-normalized-payment-reference",
    paymentReference: "by-payment-reference",
    reference: "by-reference",
    staffAccountId: "by-staff-account-id",
    staffAndCreatedAt: "by-staff-and-created-at",
    transactionGroupId: "by-transaction-group-id",
  },
  vendors: {
    accountId: "by-account-id",
    operatingStatus: "by-operating-status",
    publicCode: "by-public-code",
    walletId: "by-wallet-id",
  },
  wallets: {
    ownerAccountId: "by-owner-account-id",
    ownerType: "by-owner-type",
  },
} as const;

interface UnknownRecordStore {
  key: string;
  value: unknown;
}

export interface TokenlyDatabaseSchema extends DBSchema {
  accountPinCredentials: UnknownRecordStore;
  accounts: UnknownRecordStore & {
    indexes: {
      "by-mobile-number": string;
      "by-role": string;
      "by-status": string;
    };
  };
  auditLogs: UnknownRecordStore & {
    indexes: {
      "by-actor-account-id": string;
      "by-event-type": string;
      "by-occurred-at": string;
      "by-target": [string, string];
      "by-transaction-group-id": string;
    };
  };
  customers: UnknownRecordStore & {
    indexes: {
      "by-account-id": string;
      "by-public-code": string;
      "by-wallet-id": string;
    };
  };
  dataMetadata: UnknownRecordStore;
  evidence: UnknownRecordStore & {
    indexes: {
      "by-captured-by-account-id": string;
      "by-created-at": string;
    };
  };
  evidenceContents: UnknownRecordStore;
  eventSettings: UnknownRecordStore;
  ledgerEntries: UnknownRecordStore & {
    indexes: {
      "by-idempotency-key": string;
      "by-occurred-at": string;
      "by-related-order-id": string;
      "by-transaction-group-id": string;
      "by-wallet-and-idempotency-key": [string, string];
      "by-wallet-id": string;
    };
  };
  orders: UnknownRecordStore & {
    indexes: {
      "by-completed-at": string;
      "by-customer-and-completed-at": [string, string];
      "by-customer-id": string;
      "by-idempotency-key": string;
      "by-reference": string;
      "by-transaction-group-id": string;
      "by-vendor-and-completed-at": [string, string];
      "by-vendor-id": string;
    };
  };
  products: UnknownRecordStore & {
    indexes: {
      "by-vendor-and-archived": [string, number];
      "by-vendor-and-availability": [string, number];
      "by-vendor-and-display-order": [string, number];
      "by-vendor-and-sold-out": [string, number];
      "by-vendor-id": string;
    };
  };
  refunds: UnknownRecordStore & {
    indexes: {
      "by-created-at": string;
      "by-idempotency-key": string;
      "by-order-and-created-at": [string, string];
      "by-order-id": string;
      "by-reference": string;
      "by-transaction-group-id": string;
    };
  };
  settlements: UnknownRecordStore & {
    indexes: {
      "by-reference": string;
      "by-status": string;
      "by-vendor-and-period": [string, string, string];
      "by-vendor-id": string;
    };
  };
  tokenIssuances: UnknownRecordStore & {
    indexes: {
      "by-created-at": string;
      "by-customer-and-created-at": [string, string];
      "by-customer-id": string;
      "by-idempotency-key": string;
      "by-normalized-payment-reference": string;
      "by-payment-reference": string;
      "by-reference": string;
      "by-staff-account-id": string;
      "by-staff-and-created-at": [string, string];
      "by-transaction-group-id": string;
    };
  };
  vendors: UnknownRecordStore & {
    indexes: {
      "by-account-id": string;
      "by-operating-status": string;
      "by-public-code": string;
      "by-wallet-id": string;
    };
  };
  wallets: UnknownRecordStore & {
    indexes: {
      "by-owner-account-id": string;
      "by-owner-type": string;
    };
  };
}

export type TokenlyDatabase = IDBPDatabase<TokenlyDatabaseSchema>;
export type TokenlyStoreName = StoreNames<TokenlyDatabaseSchema>;
export type TokenlyApplicationStoreName = Exclude<
  TokenlyStoreName,
  "dataMetadata" | "evidenceContents"
>;
export type TokenlyReadWriteTransaction = IDBPTransaction<
  TokenlyDatabaseSchema,
  ArrayLike<TokenlyStoreName>,
  "readwrite"
>;
export type TokenlyPersistenceSource =
  TokenlyDatabase | TokenlyReadWriteTransaction;

type TokenlyVersionChangeTransaction = IDBPTransaction<
  TokenlyDatabaseSchema,
  TokenlyStoreName[],
  "versionchange"
>;

interface IndexDefinition {
  keyPath: string | string[];
  name: string;
  options?: IDBIndexParameters;
}

interface StoreDefinition {
  indexes?: readonly IndexDefinition[];
  keyPath: string;
  name: TokenlyStoreName;
}

const storeDefinitions = [
  { name: tokenlyStoreNames.accountPinCredentials, keyPath: "accountId" },
  {
    name: tokenlyStoreNames.accounts,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.accounts.mobileNumber,
        keyPath: "mobileNumber",
        options: { unique: true },
      },
      { name: tokenlyIndexNames.accounts.role, keyPath: "role" },
      { name: tokenlyIndexNames.accounts.status, keyPath: "status" },
    ],
  },
  {
    name: tokenlyStoreNames.customers,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.customers.accountId,
        keyPath: "accountId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.customers.walletId,
        keyPath: "walletId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.customers.publicCode,
        keyPath: "publicCode",
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.wallets,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.wallets.ownerAccountId,
        keyPath: "ownerAccountId",
        options: { unique: true },
      },
      { name: tokenlyIndexNames.wallets.ownerType, keyPath: "ownerType" },
    ],
  },
  {
    name: tokenlyStoreNames.ledgerEntries,
    keyPath: "id",
    indexes: [
      { name: tokenlyIndexNames.ledgerEntries.walletId, keyPath: "walletId" },
      {
        name: tokenlyIndexNames.ledgerEntries.transactionGroupId,
        keyPath: "transactionGroupId",
      },
      {
        name: tokenlyIndexNames.ledgerEntries.relatedOrderId,
        keyPath: "relatedOrderId",
      },
      {
        name: tokenlyIndexNames.ledgerEntries.occurredAt,
        keyPath: "occurredAt",
      },
      {
        name: tokenlyIndexNames.ledgerEntries.idempotencyKey,
        keyPath: "idempotencyKey",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.ledgerEntries.walletAndIdempotencyKey,
        keyPath: ["walletId", "idempotencyKey"],
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.tokenIssuances,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.tokenIssuances.customerId,
        keyPath: "customerId",
      },
      {
        name: tokenlyIndexNames.tokenIssuances.staffAccountId,
        keyPath: "staffAccountId",
      },
      {
        name: tokenlyIndexNames.tokenIssuances.paymentReference,
        keyPath: "paymentReference",
      },
      {
        name: tokenlyIndexNames.tokenIssuances.normalizedPaymentReference,
        keyPath: "normalizedPaymentReference",
      },
      {
        name: tokenlyIndexNames.tokenIssuances.createdAt,
        keyPath: "createdAt",
      },
      {
        name: tokenlyIndexNames.tokenIssuances.customerAndCreatedAt,
        keyPath: ["customerId", "createdAt"],
      },
      {
        name: tokenlyIndexNames.tokenIssuances.staffAndCreatedAt,
        keyPath: ["staffAccountId", "createdAt"],
      },
      {
        name: tokenlyIndexNames.tokenIssuances.transactionGroupId,
        keyPath: "transactionGroupId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.tokenIssuances.idempotencyKey,
        keyPath: "idempotencyKey",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.tokenIssuances.reference,
        keyPath: "reference",
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.evidence,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.evidence.capturedByAccountId,
        keyPath: "capturedByAccountId",
      },
      { name: tokenlyIndexNames.evidence.createdAt, keyPath: "createdAt" },
    ],
  },
  { name: tokenlyStoreNames.evidenceContents, keyPath: "id" },
  {
    name: tokenlyStoreNames.vendors,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.vendors.accountId,
        keyPath: "accountId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.vendors.walletId,
        keyPath: "walletId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.vendors.publicCode,
        keyPath: "publicCode",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.vendors.operatingStatus,
        keyPath: "operatingStatus",
      },
    ],
  },
  {
    name: tokenlyStoreNames.products,
    keyPath: "id",
    indexes: [
      { name: tokenlyIndexNames.products.vendorId, keyPath: "vendorId" },
      {
        name: tokenlyIndexNames.products.vendorAndDisplayOrder,
        keyPath: ["vendorId", "displayOrder"],
      },
      {
        name: tokenlyIndexNames.products.vendorAndAvailability,
        keyPath: ["vendorId", "isAvailableIndex"],
      },
      {
        name: tokenlyIndexNames.products.vendorAndSoldOut,
        keyPath: ["vendorId", "isSoldOutIndex"],
      },
      {
        name: tokenlyIndexNames.products.vendorAndArchived,
        keyPath: ["vendorId", "isArchivedIndex"],
      },
    ],
  },
  {
    name: tokenlyStoreNames.orders,
    keyPath: "id",
    indexes: [
      { name: tokenlyIndexNames.orders.customerId, keyPath: "customerId" },
      { name: tokenlyIndexNames.orders.vendorId, keyPath: "vendorId" },
      {
        name: tokenlyIndexNames.orders.customerAndCompletedAt,
        keyPath: ["customerId", "completedAt"],
      },
      {
        name: tokenlyIndexNames.orders.vendorAndCompletedAt,
        keyPath: ["vendorId", "completedAt"],
      },
      { name: tokenlyIndexNames.orders.completedAt, keyPath: "completedAt" },
      {
        name: tokenlyIndexNames.orders.transactionGroupId,
        keyPath: "transactionGroupId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.orders.idempotencyKey,
        keyPath: "idempotencyKey",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.orders.reference,
        keyPath: "reference",
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.refunds,
    keyPath: "id",
    indexes: [
      { name: tokenlyIndexNames.refunds.orderId, keyPath: "orderId" },
      {
        name: tokenlyIndexNames.refunds.orderAndCreatedAt,
        keyPath: ["orderId", "createdAt"],
      },
      { name: tokenlyIndexNames.refunds.createdAt, keyPath: "createdAt" },
      {
        name: tokenlyIndexNames.refunds.transactionGroupId,
        keyPath: "transactionGroupId",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.refunds.idempotencyKey,
        keyPath: "idempotencyKey",
        options: { unique: true },
      },
      {
        name: tokenlyIndexNames.refunds.reference,
        keyPath: "reference",
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.settlements,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.settlements.vendorId,
        keyPath: "vendorId",
      },
      {
        name: tokenlyIndexNames.settlements.vendorAndPeriod,
        keyPath: ["vendorId", "periodStart", "periodEnd"],
      },
      { name: tokenlyIndexNames.settlements.status, keyPath: "status" },
      {
        name: tokenlyIndexNames.settlements.reference,
        keyPath: "reference",
        options: { unique: true },
      },
    ],
  },
  {
    name: tokenlyStoreNames.auditLogs,
    keyPath: "id",
    indexes: [
      {
        name: tokenlyIndexNames.auditLogs.actorAccountId,
        keyPath: "actorAccountId",
      },
      { name: tokenlyIndexNames.auditLogs.eventType, keyPath: "eventType" },
      {
        name: tokenlyIndexNames.auditLogs.target,
        keyPath: ["targetType", "targetId"],
      },
      {
        name: tokenlyIndexNames.auditLogs.transactionGroupId,
        keyPath: "transactionGroupId",
      },
      { name: tokenlyIndexNames.auditLogs.occurredAt, keyPath: "occurredAt" },
    ],
  },
  { name: tokenlyStoreNames.eventSettings, keyPath: "id" },
  { name: tokenlyStoreNames.dataMetadata, keyPath: "key" },
] as const satisfies readonly StoreDefinition[];

export const tokenlyApplicationStoreNames = [
  tokenlyStoreNames.accountPinCredentials,
  tokenlyStoreNames.accounts,
  tokenlyStoreNames.auditLogs,
  tokenlyStoreNames.customers,
  tokenlyStoreNames.evidence,
  tokenlyStoreNames.eventSettings,
  tokenlyStoreNames.ledgerEntries,
  tokenlyStoreNames.orders,
  tokenlyStoreNames.products,
  tokenlyStoreNames.refunds,
  tokenlyStoreNames.settlements,
  tokenlyStoreNames.tokenIssuances,
  tokenlyStoreNames.vendors,
  tokenlyStoreNames.wallets,
] as const satisfies readonly TokenlyApplicationStoreName[];

export const tokenlyDataStoreNames = [
  ...tokenlyApplicationStoreNames,
  tokenlyStoreNames.evidenceContents,
] as const;

export function isTokenlyReadWriteTransaction(
  source: TokenlyPersistenceSource,
): source is TokenlyReadWriteTransaction {
  return "objectStore" in source;
}

export class TokenlyDatabaseOpenError extends Error {
  public readonly code = "TOKENLY_DATABASE_OPEN_FAILED";

  public constructor(cause: unknown) {
    super("Tokenly local data could not be opened.", { cause });
    this.name = "TokenlyDatabaseOpenError";
  }
}

export class TokenlyDatabaseDeleteError extends Error {
  public readonly code = "TOKENLY_DATABASE_DELETE_FAILED";

  public constructor(cause: unknown) {
    super("Tokenly local data could not be reset.", { cause });
    this.name = "TokenlyDatabaseDeleteError";
  }
}

const openDatabaseConnections = new Map<string, Promise<TokenlyDatabase>>();

function ensureIndexes(
  store: IDBObjectStore,
  indexes: readonly IndexDefinition[],
): void {
  for (const index of indexes) {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options);
    }
  }
}

function upgradeTokenlyDatabase(
  database: TokenlyDatabase,
  transaction: TokenlyVersionChangeTransaction,
): void {
  const nativeDatabase = unwrap(database);
  const nativeTransaction = unwrap(transaction);

  for (const definition of storeDefinitions) {
    const store = nativeDatabase.objectStoreNames.contains(definition.name)
      ? nativeTransaction.objectStore(definition.name)
      : nativeDatabase.createObjectStore(definition.name, {
          keyPath: definition.keyPath,
        });
    const indexes =
      "indexes" in definition ? definition.indexes : ([] as const);

    ensureIndexes(store, indexes);
  }
}

function closeTrackedConnection(databaseName: string): void {
  const connection = openDatabaseConnections.get(databaseName);
  if (connection === undefined) {
    return;
  }

  void connection.then((database) => {
    database.close();
    openDatabaseConnections.delete(databaseName);
  });
}

/**
 * Opens one shared connection per database name. Application callers should omit
 * the name; the override exists so contract tests can isolate their databases.
 */
export function openTokenlyDatabase(
  databaseName = TOKENLY_DATABASE_NAME,
): Promise<TokenlyDatabase> {
  const existingConnection = openDatabaseConnections.get(databaseName);
  if (existingConnection !== undefined) {
    return existingConnection;
  }

  const connection = openDB<TokenlyDatabaseSchema>(
    databaseName,
    TOKENLY_DATABASE_SCHEMA_VERSION,
    {
      upgrade: (database, _oldVersion, _newVersion, transaction) => {
        upgradeTokenlyDatabase(database, transaction);
      },
      blocking: () => {
        closeTrackedConnection(databaseName);
      },
    },
  ).catch((error: unknown) => {
    openDatabaseConnections.delete(databaseName);
    throw new TokenlyDatabaseOpenError(error);
  });

  openDatabaseConnections.set(databaseName, connection);
  return connection;
}

export async function closeTokenlyDatabaseConnections(): Promise<void> {
  const connections = [...openDatabaseConnections.values()];
  openDatabaseConnections.clear();

  const databases = await Promise.allSettled(connections);
  for (const result of databases) {
    if (result.status === "fulfilled") {
      result.value.close();
    }
  }
}

export async function closeTokenlyDatabaseConnection(
  databaseName = TOKENLY_DATABASE_NAME,
): Promise<void> {
  const connection = openDatabaseConnections.get(databaseName);
  openDatabaseConnections.delete(databaseName);

  if (connection === undefined) {
    return;
  }

  const database = await connection;
  database.close();
}

/**
 * Deletes only Tokenly's fixed local database. There is intentionally no target
 * argument, which prevents development reset from deleting an arbitrary origin
 * database.
 */
export async function deleteTokenlyDatabase(): Promise<void> {
  await closeTokenlyDatabaseConnection(TOKENLY_DATABASE_NAME);

  try {
    await deleteDB(TOKENLY_DATABASE_NAME);
  } catch (error: unknown) {
    throw new TokenlyDatabaseDeleteError(error);
  }
}
