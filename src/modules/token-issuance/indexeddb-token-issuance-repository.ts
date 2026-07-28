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
  TokenIssuance,
  TokenIssuanceId,
  TokenIssuanceQuery,
} from "./token-issuance";
import type { TokenIssuanceRepository } from "./token-issuance-repository";
import {
  tokenIssuanceQuerySchema,
  tokenIssuanceSchema,
} from "./token-issuance-schema";

export class IndexedDbTokenIssuanceRepository implements TokenIssuanceRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: TokenIssuanceId): Promise<TokenIssuance | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      id,
      tokenIssuanceSchema,
    );
  }

  public getByReference(reference: string): Promise<TokenIssuance | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenlyIndexNames.tokenIssuances.reference,
      reference,
      tokenIssuanceSchema,
    );
  }

  public getByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<TokenIssuance | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenlyIndexNames.tokenIssuances.transactionGroupId,
      transactionGroupId,
      tokenIssuanceSchema,
    );
  }

  public getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<TokenIssuance | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenlyIndexNames.tokenIssuances.idempotencyKey,
      idempotencyKey,
      tokenIssuanceSchema,
    );
  }

  public async findByNormalizedPaymentReference(
    normalizedPaymentReference: string,
  ): Promise<readonly TokenIssuance[]> {
    const issuances = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenlyIndexNames.tokenIssuances.normalizedPaymentReference,
      normalizedPaymentReference,
      tokenIssuanceSchema,
    );

    return newestFirst(issuances, ({ createdAt }) => createdAt);
  }

  public async list(
    query?: TokenIssuanceQuery,
  ): Promise<readonly TokenIssuance[]> {
    const parsedQuery = tokenIssuanceQuerySchema.parse(query ?? {});
    const issuances = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenIssuanceSchema,
    );

    return newestFirst(
      issuances.filter(
        (issuance) =>
          (parsedQuery.customerId === undefined ||
            issuance.customerId === parsedQuery.customerId) &&
          (parsedQuery.staffAccountId === undefined ||
            issuance.staffAccountId === parsedQuery.staffAccountId) &&
          isWithinUtcRange(
            issuance.createdAt,
            parsedQuery.fromCreatedAt,
            parsedQuery.toCreatedAt,
          ),
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public create(issuance: TokenIssuance): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.tokenIssuances,
      tokenIssuanceSchema,
      issuance,
    );
  }
}
