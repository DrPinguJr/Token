import type { AuditLog, AuditLogId, AuditLogQuery } from "./audit-log";

export interface AuditLogRepository {
  getById(id: AuditLogId): Promise<AuditLog | null>;
  findByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<readonly AuditLog[]>;
  list(query?: AuditLogQuery): Promise<readonly AuditLog[]>;
  append(entry: AuditLog): Promise<void>;
}
