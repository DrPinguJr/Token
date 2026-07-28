import {
  addStoredRecord,
  ascendingText,
  containsNormalizedSearch,
  getAllStoredRecords,
  getStoredRecord,
  getStoredRecordFromIndex,
  isTokenlyReadWriteTransaction,
  putStoredRecord,
  replaceStoredRecord,
  StoredRecordNotFoundError,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type {
  Account,
  AccountId,
  AccountPinCredential,
  AccountQuery,
} from "./account";
import type {
  AccountPinCredentialRepository,
  AccountRepository,
} from "./account-repository";
import {
  accountPinCredentialSchema,
  accountQuerySchema,
  accountSchema,
} from "./account-schema";

export class AccountCredentialMismatchError extends Error {
  public readonly code = "ACCOUNT_CREDENTIAL_MISMATCH";

  public constructor() {
    super("The PIN credential does not belong to the account being created.");
    this.name = "AccountCredentialMismatchError";
  }
}

export class IndexedDbAccountRepository
  implements AccountRepository, AccountPinCredentialRepository
{
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: AccountId): Promise<Account | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.accounts,
      id,
      accountSchema,
    );
  }

  public getByMobileNumber(
    normalizedMobileNumber: string,
  ): Promise<Account | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.accounts,
      tokenlyIndexNames.accounts.mobileNumber,
      normalizedMobileNumber,
      accountSchema,
    );
  }

  public async list(query?: AccountQuery): Promise<readonly Account[]> {
    const parsedQuery = accountQuerySchema.parse(query ?? {});
    const accounts = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.accounts,
      accountSchema,
    );

    return ascendingText(
      accounts.filter(
        (account) =>
          (parsedQuery.role === undefined ||
            account.role === parsedQuery.role) &&
          (parsedQuery.status === undefined ||
            account.status === parsedQuery.status) &&
          (parsedQuery.search === undefined ||
            containsNormalizedSearch(parsedQuery.search, [
              account.displayName,
              account.mobileNumber,
              account.username ?? "",
            ])),
      ),
      ({ displayName }) => displayName,
    );
  }

  public async create(
    account: Account,
    initialPinCredential: AccountPinCredential,
  ): Promise<void> {
    if (initialPinCredential.accountId !== account.id) {
      throw new AccountCredentialMismatchError();
    }

    if (isTokenlyReadWriteTransaction(this.database)) {
      await this.addAccountRecords(
        this.database,
        account,
        initialPinCredential,
      );
      return;
    }

    const transaction = this.database.transaction(
      [tokenlyStoreNames.accounts, tokenlyStoreNames.accountPinCredentials],
      "readwrite",
    );

    try {
      await this.addAccountRecords(transaction, account, initialPinCredential);
      await transaction.done;
    } catch (error: unknown) {
      await transaction.done.catch(() => undefined);
      throw error;
    }
  }

  public update(account: Account): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.accounts,
      accountSchema,
      account,
    );
  }

  public getPinCredentialByAccountId(
    accountId: AccountId,
  ): Promise<AccountPinCredential | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.accountPinCredentials,
      accountId,
      accountPinCredentialSchema,
    );
  }

  public async updatePinCredential(
    credential: AccountPinCredential,
  ): Promise<void> {
    const existingCredential = await this.getPinCredentialByAccountId(
      credential.accountId,
    );

    if (existingCredential === null) {
      throw new StoredRecordNotFoundError(
        tokenlyStoreNames.accountPinCredentials,
        credential.accountId,
      );
    }

    await putStoredRecord(
      this.database,
      tokenlyStoreNames.accountPinCredentials,
      accountPinCredentialSchema,
      credential,
    );
  }

  private async addAccountRecords(
    source: TokenlyPersistenceSource,
    account: Account,
    credential: AccountPinCredential,
  ): Promise<void> {
    await Promise.all([
      addStoredRecord(
        source,
        tokenlyStoreNames.accounts,
        accountSchema,
        account,
      ),
      addStoredRecord(
        source,
        tokenlyStoreNames.accountPinCredentials,
        accountPinCredentialSchema,
        credential,
      ),
    ]);
  }
}
