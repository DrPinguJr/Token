import type { Order, OrderId, OrderQuery } from "./order";

export interface OrderRepository {
  getById(id: OrderId): Promise<Order | null>;
  getByReference(reference: string): Promise<Order | null>;
  getByTransactionGroupId(transactionGroupId: string): Promise<Order | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<Order | null>;
  list(query?: OrderQuery): Promise<readonly Order[]>;
  create(order: Order): Promise<void>;
}
