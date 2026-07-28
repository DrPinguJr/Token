import { z } from "zod";

import {
  TOKENLY_DATA_VERSION,
  countStoredRecords,
  deleteTokenlyDatabase,
  getStoredRecord,
  openTokenlyDatabase,
  putStoredRecord,
  tokenlyDataStoreNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";
import {
  positiveSafeIntegerSchema,
  utcTimestampSchema,
} from "@/shared/validation";

import type { LocalRepositoryRegistry } from "./local-repositories";
import { createLocalRepositoryRegistry } from "./local-repository-registry";

export const TOKENLY_DATA_METADATA_KEY = "tokenly-data";

export const localDataMetadataSchema = z
  .object({
    key: z.literal(TOKENLY_DATA_METADATA_KEY),
    schemaVersion: positiveSafeIntegerSchema,
    seedVersion: positiveSafeIntegerSchema,
    seededAt: utcTimestampSchema,
  })
  .strict();

export type LocalDataMetadata = Readonly<
  z.infer<typeof localDataMetadataSchema>
>;

export type LocalDataInitializationResult =
  | {
      readonly status: "initialized";
      readonly metadata: LocalDataMetadata;
    }
  | {
      readonly status: "already-initialized";
      readonly metadata: LocalDataMetadata;
    };

export interface InitializeLocalDataOptions {
  readonly seedVersion: number;
  readonly seed: (repositories: LocalRepositoryRegistry) => Promise<void>;
  readonly now?: () => string;
}

export class LocalDataVersionError extends Error {
  public readonly code = "LOCAL_DATA_VERSION_UNSUPPORTED";

  public constructor(
    public readonly storedVersion: number,
    public readonly supportedVersion: number,
  ) {
    super(
      `Local data version ${storedVersion} is not supported by version ${supportedVersion}.`,
    );
    this.name = "LocalDataVersionError";
  }
}

export class LocalDataInitializationError extends Error {
  public readonly code = "LOCAL_DATA_INITIALIZATION_FAILED";

  public constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LocalDataInitializationError";
  }
}

async function readMetadata(
  database: TokenlyPersistenceSource,
): Promise<LocalDataMetadata | null> {
  return getStoredRecord(
    database,
    tokenlyStoreNames.dataMetadata,
    TOKENLY_DATA_METADATA_KEY,
    localDataMetadataSchema,
  );
}

async function assertDataStoresAreEmpty(
  database: TokenlyPersistenceSource,
): Promise<void> {
  const counts = await Promise.all(
    tokenlyDataStoreNames.map((storeName) =>
      countStoredRecords(database, storeName),
    ),
  );

  if (counts.some((count) => count > 0)) {
    throw new LocalDataInitializationError(
      "Local data exists without initialization metadata. Reset must be explicitly confirmed before seeding.",
    );
  }
}

export async function getLocalDataMetadata(): Promise<LocalDataMetadata | null> {
  const database = await openTokenlyDatabase();
  return readMetadata(database);
}

/**
 * Serializes first-run checks, repository seeding, and metadata in one
 * cross-store transaction. Concurrent tabs re-read metadata only after the
 * winning transaction commits, and a failed seed rolls back without deleting
 * another caller's data.
 */
export async function initializeLocalData(
  options: InitializeLocalDataOptions,
): Promise<LocalDataInitializationResult> {
  const seedVersion = positiveSafeIntegerSchema.parse(options.seedVersion);
  const database = await openTokenlyDatabase();
  const transaction = database.transaction(
    [...tokenlyDataStoreNames, tokenlyStoreNames.dataMetadata],
    "readwrite",
  );
  const repositories = createLocalRepositoryRegistry(transaction);

  try {
    const existingMetadata = await readMetadata(transaction);

    if (existingMetadata !== null) {
      if (existingMetadata.schemaVersion !== TOKENLY_DATA_VERSION) {
        throw new LocalDataVersionError(
          existingMetadata.schemaVersion,
          TOKENLY_DATA_VERSION,
        );
      }

      await transaction.done;
      return {
        status: "already-initialized",
        metadata: existingMetadata,
      };
    }

    await assertDataStoresAreEmpty(transaction);
    await options.seed(repositories);

    const metadata = localDataMetadataSchema.parse({
      key: TOKENLY_DATA_METADATA_KEY,
      schemaVersion: TOKENLY_DATA_VERSION,
      seedVersion,
      seededAt: (options.now ?? (() => new Date().toISOString()))(),
    });

    await putStoredRecord(
      transaction,
      tokenlyStoreNames.dataMetadata,
      localDataMetadataSchema,
      metadata,
    );

    await transaction.done;
    return { status: "initialized", metadata };
  } catch (error: unknown) {
    try {
      transaction.abort();
    } catch (abortError: unknown) {
      if (
        !(abortError instanceof DOMException) ||
        abortError.name !== "InvalidStateError"
      ) {
        throw abortError;
      }
    }

    await transaction.done.catch(() => undefined);

    if (
      error instanceof LocalDataInitializationError ||
      error instanceof LocalDataVersionError
    ) {
      throw error;
    }

    throw new LocalDataInitializationError(
      "First-run Tokenly data initialization failed and its transaction was rolled back.",
      error,
    );
  }
}

/**
 * Removes only the fixed Tokenly IndexedDB database. Session preferences remain
 * untouched and reseeding is a separate explicit operation.
 */
export function resetLocalData(): Promise<void> {
  return deleteTokenlyDatabase();
}
