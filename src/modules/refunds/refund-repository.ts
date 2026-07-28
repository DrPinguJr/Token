import type { Refund, RefundId, RefundQuery } from "./refund";

export interface RefundRepository {
  getById(id: RefundId): Promise<Refund | null>;
  getByReference(reference: string): Promise<Refund | null>;
  getByTransactionGroupId(transactionGroupId: string): Promise<Refund | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<Refund | null>;
  findByOrderId(orderId: string): Promise<readonly Refund[]>;
  list(query?: RefundQuery): Promise<readonly Refund[]>;
  create(refund: Refund): Promise<void>;
}
