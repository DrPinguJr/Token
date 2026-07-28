import type { Wallet, WalletId, WalletQuery } from "./wallet";

export interface WalletRepository {
  getById(id: WalletId): Promise<Wallet | null>;
  getByOwnerAccountId(ownerAccountId: string): Promise<Wallet | null>;
  list(query?: WalletQuery): Promise<readonly Wallet[]>;
  create(wallet: Wallet): Promise<void>;
  update(wallet: Wallet): Promise<void>;
}
