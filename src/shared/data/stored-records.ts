import type { IndexKey, IndexNames, StoreNames } from "idb";
import type { z } from "zod";

import type {
  TokenlyDatabaseSchema,
  TokenlyPersistenceSource,
  TokenlyStoreName,
} from "./tokenly-database";
import { isTokenlyReadWriteTransaction } from "./tokenly-database";

export class StoredRecordValidationError extends Error {
  public readonly code = "STORED_RECORD_INVALID";

  public constructor(
    public readonly storeName: TokenlyStoreName,
    public readonly recordKey: IDBValidKey | undefined,
    issuePaths: readonly string[],
  ) {
    const location =
      recordKey === undefined ? storeName : `${storeName}/${String(recordKey)}`;
    const issueSummary =
      issuePaths.length === 0 ? "unknown field" : issuePaths.join(", ");

    super(`Invalid local record at ${location}; check ${issueSummary}.`);
    this.name = "StoredRecordValidationError";
  }
}

export class StoredRecordConflictError extends Error {
  public readonly code = "STORED_RECORD_CONFLICT";

  public constructor(
    public readonly storeName: TokenlyStoreName,
    cause: unknown,
  ) {
    super(`A ${storeName} record conflicts with existing local data.`, {
      cause,
    });
    this.name = "StoredRecordConflictError";
  }
}

export class StoredRecordNotFoundError extends Error {
  public readonly code = "STORED_RECORD_NOT_FOUND";

  public constructor(
    public readonly storeName: TokenlyStoreName,
    public readonly recordKey: string,
  ) {
    super(`The ${storeName} record ${recordKey} does not exist.`);
    this.name = "StoredRecordNotFoundError";
  }
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length === 0 ? "record" : path.map(String).join(".");
}

export function parseStoredRecord<T>(
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
  value: unknown,
  recordKey?: IDBValidKey,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new StoredRecordValidationError(
      storeName,
      recordKey,
      result.error.issues.map(({ path }) => formatIssuePath(path)),
    );
  }

  return result.data;
}

export function parseStoredRecords<T>(
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
  values: readonly unknown[],
): T[] {
  return values.map((value) => parseStoredRecord(storeName, schema, value));
}

export async function getStoredRecord<T>(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const value: unknown = isTokenlyReadWriteTransaction(source)
    ? await source.objectStore(storeName).get(key)
    : await source.get(storeName, key);

  return value === undefined
    ? null
    : parseStoredRecord(storeName, schema, value, key);
}

export async function getAllStoredRecords<T>(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const values: unknown[] = isTokenlyReadWriteTransaction(source)
    ? await source.objectStore(storeName).getAll()
    : await source.getAll(storeName);
  return parseStoredRecords(storeName, schema, values);
}

export async function getAllStoredRecordsFromIndex<
  T,
  StoreName extends StoreNames<TokenlyDatabaseSchema>,
  IndexName extends IndexNames<TokenlyDatabaseSchema, StoreName>,
>(
  source: TokenlyPersistenceSource,
  storeName: StoreName,
  indexName: IndexName,
  query: IndexKey<TokenlyDatabaseSchema, StoreName, IndexName> | IDBKeyRange,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const values: unknown[] = isTokenlyReadWriteTransaction(source)
    ? await source.objectStore(storeName).index(indexName).getAll(query)
    : await source.getAllFromIndex(storeName, indexName, query);
  return parseStoredRecords(storeName, schema, values);
}

export async function getStoredRecordFromIndex<
  T,
  StoreName extends StoreNames<TokenlyDatabaseSchema>,
  IndexName extends IndexNames<TokenlyDatabaseSchema, StoreName>,
>(
  source: TokenlyPersistenceSource,
  storeName: StoreName,
  indexName: IndexName,
  query: IndexKey<TokenlyDatabaseSchema, StoreName, IndexName> | IDBKeyRange,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const value: unknown = isTokenlyReadWriteTransaction(source)
    ? await source.objectStore(storeName).index(indexName).get(query)
    : await source.getFromIndex(storeName, indexName, query);

  return value === undefined
    ? null
    : parseStoredRecord(storeName, schema, value);
}

function toStoredRecordConflict(
  storeName: TokenlyStoreName,
  error: unknown,
): never {
  if (error instanceof DOMException && error.name === "ConstraintError") {
    throw new StoredRecordConflictError(storeName, error);
  }

  throw error;
}

export async function addStoredRecord<T>(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
  record: T,
): Promise<void> {
  const parsedRecord = parseStoredRecord(storeName, schema, record);

  try {
    if (isTokenlyReadWriteTransaction(source)) {
      await source.objectStore(storeName).add(parsedRecord);
    } else {
      await source.add(storeName, parsedRecord);
    }
  } catch (error: unknown) {
    toStoredRecordConflict(storeName, error);
  }
}

export async function putStoredRecord<T>(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
  record: T,
): Promise<void> {
  const parsedRecord = parseStoredRecord(storeName, schema, record);

  try {
    if (isTokenlyReadWriteTransaction(source)) {
      await source.objectStore(storeName).put(parsedRecord);
    } else {
      await source.put(storeName, parsedRecord);
    }
  } catch (error: unknown) {
    toStoredRecordConflict(storeName, error);
  }
}

export async function replaceStoredRecord<T extends { readonly id: string }>(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
  schema: z.ZodType<T>,
  record: T,
): Promise<void> {
  const existingRecord = await getStoredRecord(
    source,
    storeName,
    record.id,
    schema,
  );

  if (existingRecord === null) {
    throw new StoredRecordNotFoundError(storeName, record.id);
  }

  await putStoredRecord(source, storeName, schema, record);
}

export async function countStoredRecords(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
): Promise<number> {
  return isTokenlyReadWriteTransaction(source)
    ? source.objectStore(storeName).count()
    : source.count(storeName);
}

export async function clearStoredRecords(
  source: TokenlyPersistenceSource,
  storeName: TokenlyStoreName,
): Promise<void> {
  if (isTokenlyReadWriteTransaction(source)) {
    await source.objectStore(storeName).clear();
  } else {
    await source.clear(storeName);
  }
}
