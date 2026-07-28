import {
  addStoredRecord,
  getAllStoredRecords,
  getStoredRecord,
  getStoredRecordFromIndex,
  isWithinUtcRange,
  newestFirst,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { Order, OrderId, OrderQuery } from "./order";
import type { OrderRepository } from "./order-repository";
import { orderQuerySchema, orderSchema } from "./order-schema";

export class IndexedDbOrderRepository implements OrderRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: OrderId): Promise<Order | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.orders,
      id,
      orderSchema,
    );
  }

  public getByReference(reference: string): Promise<Order | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.orders,
      tokenlyIndexNames.orders.reference,
      reference,
      orderSchema,
    );
  }

  public getByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<Order | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.orders,
      tokenlyIndexNames.orders.transactionGroupId,
      transactionGroupId,
      orderSchema,
    );
  }

  public getByIdempotencyKey(idempotencyKey: string): Promise<Order | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.orders,
      tokenlyIndexNames.orders.idempotencyKey,
      idempotencyKey,
      orderSchema,
    );
  }

  public async list(query?: OrderQuery): Promise<readonly Order[]> {
    const parsedQuery = orderQuerySchema.parse(query ?? {});
    const orders = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.orders,
      orderSchema,
    );

    return newestFirst(
      orders.filter(
        (order) =>
          (parsedQuery.customerId === undefined ||
            order.customerId === parsedQuery.customerId) &&
          (parsedQuery.vendorId === undefined ||
            order.vendorId === parsedQuery.vendorId) &&
          isWithinUtcRange(
            order.completedAt,
            parsedQuery.fromCompletedAt,
            parsedQuery.toCompletedAt,
          ),
      ),
      ({ completedAt }) => completedAt,
    );
  }

  public create(order: Order): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.orders,
      orderSchema,
      order,
    );
  }
}
