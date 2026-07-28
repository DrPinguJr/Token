import {
  addStoredRecord,
  getAllStoredRecords,
  getAllStoredRecordsFromIndex,
  getStoredRecord,
  getStoredRecordFromIndex,
  isWithinUtcRange,
  newestFirst,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type {
  LedgerEntry,
  LedgerEntryId,
  LedgerEntryQuery,
  TransactionGroupId,
} from "./ledger-entry";
import type { LedgerEntryRepository } from "./ledger-entry-repository";
import {
  ledgerEntryQuerySchema,
  ledgerEntrySchema,
} from "./ledger-entry-schema";

export class IndexedDbLedgerEntryRepository implements LedgerEntryRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: LedgerEntryId): Promise<LedgerEntry | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      id,
      ledgerEntrySchema,
    );
  }

  public async findByWalletId(
    walletId: string,
  ): Promise<readonly LedgerEntry[]> {
    const entries = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      tokenlyIndexNames.ledgerEntries.walletId,
      walletId,
      ledgerEntrySchema,
    );

    return newestFirst(entries, ({ occurredAt }) => occurredAt);
  }

  public async findByTransactionGroupId(
    transactionGroupId: TransactionGroupId,
  ): Promise<readonly LedgerEntry[]> {
    const entries = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      tokenlyIndexNames.ledgerEntries.transactionGroupId,
      transactionGroupId,
      ledgerEntrySchema,
    );

    return newestFirst(entries, ({ occurredAt }) => occurredAt);
  }

  public async findByRelatedOrderId(
    orderId: string,
  ): Promise<readonly LedgerEntry[]> {
    const entries = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      tokenlyIndexNames.ledgerEntries.relatedOrderId,
      orderId,
      ledgerEntrySchema,
    );

    return newestFirst(entries, ({ occurredAt }) => occurredAt);
  }

  public getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<LedgerEntry | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      tokenlyIndexNames.ledgerEntries.idempotencyKey,
      idempotencyKey,
      ledgerEntrySchema,
    );
  }

  public findByWalletAndIdempotencyKey(
    walletId: string,
    idempotencyKey: string,
  ): Promise<LedgerEntry | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      tokenlyIndexNames.ledgerEntries.walletAndIdempotencyKey,
      [walletId, idempotencyKey],
      ledgerEntrySchema,
    );
  }

  public async list(query?: LedgerEntryQuery): Promise<readonly LedgerEntry[]> {
    const parsedQuery = ledgerEntryQuerySchema.parse(query ?? {});
    const entries = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      ledgerEntrySchema,
    );

    return newestFirst(
      entries.filter(
        (entry) =>
          (parsedQuery.walletId === undefined ||
            entry.walletId === parsedQuery.walletId) &&
          (parsedQuery.transactionGroupId === undefined ||
            entry.transactionGroupId === parsedQuery.transactionGroupId) &&
          (parsedQuery.entryType === undefined ||
            entry.entryType === parsedQuery.entryType) &&
          (parsedQuery.direction === undefined ||
            entry.direction === parsedQuery.direction) &&
          (parsedQuery.actorAccountId === undefined ||
            entry.actorAccountId === parsedQuery.actorAccountId) &&
          (parsedQuery.relatedCustomerId === undefined ||
            entry.relatedCustomerId === parsedQuery.relatedCustomerId) &&
          (parsedQuery.relatedVendorId === undefined ||
            entry.relatedVendorId === parsedQuery.relatedVendorId) &&
          (parsedQuery.relatedOrderId === undefined ||
            entry.relatedOrderId === parsedQuery.relatedOrderId) &&
          isWithinUtcRange(
            entry.occurredAt,
            parsedQuery.fromOccurredAt,
            parsedQuery.toOccurredAt,
          ),
      ),
      ({ occurredAt }) => occurredAt,
    );
  }

  public append(entry: LedgerEntry): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.ledgerEntries,
      ledgerEntrySchema,
      entry,
    );
  }
}
