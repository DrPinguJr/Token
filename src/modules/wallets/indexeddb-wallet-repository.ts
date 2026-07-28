import {
  addStoredRecord,
  getAllStoredRecords,
  getStoredRecord,
  getStoredRecordFromIndex,
  newestFirst,
  replaceStoredRecord,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { Wallet, WalletId, WalletQuery } from "./wallet";
import type { WalletRepository } from "./wallet-repository";
import { walletQuerySchema, walletSchema } from "./wallet-schema";

export class IndexedDbWalletRepository implements WalletRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: WalletId): Promise<Wallet | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.wallets,
      id,
      walletSchema,
    );
  }

  public getByOwnerAccountId(ownerAccountId: string): Promise<Wallet | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.wallets,
      tokenlyIndexNames.wallets.ownerAccountId,
      ownerAccountId,
      walletSchema,
    );
  }

  public async list(query?: WalletQuery): Promise<readonly Wallet[]> {
    const parsedQuery = walletQuerySchema.parse(query ?? {});
    const wallets = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.wallets,
      walletSchema,
    );

    return newestFirst(
      wallets.filter(
        (wallet) =>
          (parsedQuery.ownerType === undefined ||
            wallet.ownerType === parsedQuery.ownerType) &&
          (parsedQuery.status === undefined ||
            wallet.status === parsedQuery.status),
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public create(wallet: Wallet): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.wallets,
      walletSchema,
      wallet,
    );
  }

  public update(wallet: Wallet): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.wallets,
      walletSchema,
      wallet,
    );
  }
}
