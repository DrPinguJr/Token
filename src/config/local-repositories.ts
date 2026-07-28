import {
  TOKENLY_DATABASE_NAME,
  closeTokenlyDatabaseConnection,
  openTokenlyDatabase,
  tokenlyDataStoreNames,
  type TokenlyDatabase,
} from "@/shared/data";

import {
  createLocalRepositoryRegistry,
  type LocalRepositoryRegistry,
} from "./local-repository-registry";

export type { LocalRepositoryRegistry } from "./local-repository-registry";

export interface LocalRepositories extends LocalRepositoryRegistry {
  readonly close: () => Promise<void>;
}

export interface CreateLocalRepositoriesOptions {
  /**
   * Application code should omit this. Isolated repository contract tests may
   * supply a unique database name.
   */
  readonly databaseName?: string;
}

export type RunLocalRepositoryTransactionOptions =
  CreateLocalRepositoriesOptions;

export async function createLocalRepositories(
  options: CreateLocalRepositoriesOptions = {},
): Promise<LocalRepositories> {
  const databaseName = options.databaseName ?? TOKENLY_DATABASE_NAME;
  const database = await openTokenlyDatabase(databaseName);

  return {
    ...createLocalRepositoryRegistry(database),
    close: () => closeTokenlyDatabaseConnection(databaseName),
  };
}

/**
 * Runs repository work against one IndexedDB transaction spanning every
 * application data store. The callback may await repository operations only;
 * unrelated asynchronous gaps can let browsers auto-commit an IndexedDB
 * transaction.
 */
export async function runInLocalRepositoryTransaction<Result>(
  work: (repositories: LocalRepositoryRegistry) => Promise<Result>,
  options: RunLocalRepositoryTransactionOptions = {},
): Promise<Result> {
  const database: TokenlyDatabase = await openTokenlyDatabase(
    options.databaseName ?? TOKENLY_DATABASE_NAME,
  );
  const transaction = database.transaction(
    [...tokenlyDataStoreNames],
    "readwrite",
  );
  const repositories = createLocalRepositoryRegistry(transaction);

  try {
    const result = await work(repositories);
    await transaction.done;
    return result;
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
    throw error;
  }
}
