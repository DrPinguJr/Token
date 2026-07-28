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

import type { Refund, RefundId, RefundQuery } from "./refund";
import type { RefundRepository } from "./refund-repository";
import { refundQuerySchema, refundSchema } from "./refund-schema";

export class IndexedDbRefundRepository implements RefundRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: RefundId): Promise<Refund | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.refunds,
      id,
      refundSchema,
    );
  }

  public getByReference(reference: string): Promise<Refund | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.refunds,
      tokenlyIndexNames.refunds.reference,
      reference,
      refundSchema,
    );
  }

  public getByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<Refund | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.refunds,
      tokenlyIndexNames.refunds.transactionGroupId,
      transactionGroupId,
      refundSchema,
    );
  }

  public getByIdempotencyKey(idempotencyKey: string): Promise<Refund | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.refunds,
      tokenlyIndexNames.refunds.idempotencyKey,
      idempotencyKey,
      refundSchema,
    );
  }

  public async findByOrderId(orderId: string): Promise<readonly Refund[]> {
    const refunds = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.refunds,
      tokenlyIndexNames.refunds.orderId,
      orderId,
      refundSchema,
    );

    return newestFirst(refunds, ({ createdAt }) => createdAt);
  }

  public async list(query?: RefundQuery): Promise<readonly Refund[]> {
    const parsedQuery = refundQuerySchema.parse(query ?? {});
    const refunds = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.refunds,
      refundSchema,
    );

    return newestFirst(
      refunds.filter(
        (refund) =>
          (parsedQuery.orderId === undefined ||
            refund.orderId === parsedQuery.orderId) &&
          (parsedQuery.customerId === undefined ||
            refund.customerId === parsedQuery.customerId) &&
          (parsedQuery.vendorId === undefined ||
            refund.vendorId === parsedQuery.vendorId) &&
          (parsedQuery.actorAccountId === undefined ||
            refund.actorAccountId === parsedQuery.actorAccountId) &&
          isWithinUtcRange(
            refund.createdAt,
            parsedQuery.fromCreatedAt,
            parsedQuery.toCreatedAt,
          ),
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public create(refund: Refund): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.refunds,
      refundSchema,
      refund,
    );
  }
}
