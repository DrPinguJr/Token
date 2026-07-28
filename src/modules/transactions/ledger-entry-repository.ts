import type {
  LedgerEntry,
  LedgerEntryId,
  LedgerEntryQuery,
  TransactionGroupId,
} from "./ledger-entry";

export interface LedgerEntryRepository {
  getById(id: LedgerEntryId): Promise<LedgerEntry | null>;
  findByWalletId(walletId: string): Promise<readonly LedgerEntry[]>;
  findByTransactionGroupId(
    transactionGroupId: TransactionGroupId,
  ): Promise<readonly LedgerEntry[]>;
  findByRelatedOrderId(orderId: string): Promise<readonly LedgerEntry[]>;
  getByIdempotencyKey(idempotencyKey: string): Promise<LedgerEntry | null>;
  findByWalletAndIdempotencyKey(
    walletId: string,
    idempotencyKey: string,
  ): Promise<LedgerEntry | null>;
  list(query?: LedgerEntryQuery): Promise<readonly LedgerEntry[]>;
  append(entry: LedgerEntry): Promise<void>;
}
