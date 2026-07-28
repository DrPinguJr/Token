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

import type { Settlement, SettlementId, SettlementQuery } from "./settlement";
import type { SettlementRepository } from "./settlement-repository";
import { settlementQuerySchema, settlementSchema } from "./settlement-schema";

export class IndexedDbSettlementRepository implements SettlementRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: SettlementId): Promise<Settlement | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.settlements,
      id,
      settlementSchema,
    );
  }

  public getByReference(reference: string): Promise<Settlement | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.settlements,
      tokenlyIndexNames.settlements.reference,
      reference,
      settlementSchema,
    );
  }

  public async list(query?: SettlementQuery): Promise<readonly Settlement[]> {
    const parsedQuery = settlementQuerySchema.parse(query ?? {});
    const settlements = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.settlements,
      settlementSchema,
    );

    return newestFirst(
      settlements.filter(
        (settlement) =>
          (parsedQuery.vendorId === undefined ||
            settlement.vendorId === parsedQuery.vendorId) &&
          (parsedQuery.status === undefined ||
            settlement.status === parsedQuery.status) &&
          (parsedQuery.periodStartFrom === undefined ||
            Date.parse(settlement.periodStart) >=
              Date.parse(parsedQuery.periodStartFrom)) &&
          (parsedQuery.periodEndTo === undefined ||
            Date.parse(settlement.periodEnd) <=
              Date.parse(parsedQuery.periodEndTo)),
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public create(settlement: Settlement): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.settlements,
      settlementSchema,
      settlement,
    );
  }

  public update(settlement: Settlement): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.settlements,
      settlementSchema,
      settlement,
    );
  }
}
