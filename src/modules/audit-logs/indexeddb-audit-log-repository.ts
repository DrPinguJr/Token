import {
  addStoredRecord,
  getAllStoredRecords,
  getAllStoredRecordsFromIndex,
  getStoredRecord,
  isWithinUtcRange,
  newestFirst,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { AuditLog, AuditLogId, AuditLogQuery } from "./audit-log";
import type { AuditLogRepository } from "./audit-log-repository";
import { assertSafeAuditMetadata } from "./append-only-audit-service";
import { auditLogQuerySchema, auditLogSchema } from "./audit-log-schema";

export class IndexedDbAuditLogRepository implements AuditLogRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: AuditLogId): Promise<AuditLog | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.auditLogs,
      id,
      auditLogSchema,
    );
  }

  public async findByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<readonly AuditLog[]> {
    const entries = await getAllStoredRecordsFromIndex(
      this.database,
      tokenlyStoreNames.auditLogs,
      tokenlyIndexNames.auditLogs.transactionGroupId,
      transactionGroupId,
      auditLogSchema,
    );

    return newestFirst(entries, ({ occurredAt }) => occurredAt);
  }

  public async list(query?: AuditLogQuery): Promise<readonly AuditLog[]> {
    const parsedQuery = auditLogQuerySchema.parse(query ?? {});
    const entries = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.auditLogs,
      auditLogSchema,
    );

    return newestFirst(
      entries.filter(
        (entry) =>
          (parsedQuery.eventType === undefined ||
            entry.eventType === parsedQuery.eventType) &&
          (parsedQuery.actorAccountId === undefined ||
            entry.actorAccountId === parsedQuery.actorAccountId) &&
          (parsedQuery.targetType === undefined ||
            entry.targetType === parsedQuery.targetType) &&
          (parsedQuery.targetId === undefined ||
            entry.targetId === parsedQuery.targetId) &&
          (parsedQuery.transactionGroupId === undefined ||
            entry.transactionGroupId === parsedQuery.transactionGroupId) &&
          isWithinUtcRange(
            entry.occurredAt,
            parsedQuery.fromOccurredAt,
            parsedQuery.toOccurredAt,
          ),
      ),
      ({ occurredAt }) => occurredAt,
    );
  }

  public async append(entry: AuditLog): Promise<void> {
    const parsedEntry = auditLogSchema.parse(entry);
    assertSafeAuditMetadata(parsedEntry.metadata);

    await addStoredRecord(
      this.database,
      tokenlyStoreNames.auditLogs,
      auditLogSchema,
      parsedEntry,
    );
  }
}
