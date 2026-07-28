import { describe, expect, it } from "vitest";

import {
  AppendOnlyAuditService,
  SensitiveAuditMetadataError,
  prepareAuditLog,
} from "./append-only-audit-service";
import type { AuditLog, AuditLogQuery } from "./audit-log";
import type { AuditLogRepository } from "./audit-log-repository";

class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly records: AuditLog[] = [];

  async getById(id: string): Promise<AuditLog | null> {
    return this.records.find((record) => record.id === id) ?? null;
  }

  async findByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<readonly AuditLog[]> {
    return this.records.filter(
      (record) => record.transactionGroupId === transactionGroupId,
    );
  }

  async list(query?: AuditLogQuery): Promise<readonly AuditLog[]> {
    if (!query) {
      return [...this.records];
    }

    return this.records.filter(
      (record) =>
        (query.eventType === undefined ||
          record.eventType === query.eventType) &&
        (query.targetId === undefined || record.targetId === query.targetId),
    );
  }

  async append(entry: AuditLog): Promise<void> {
    this.records.push(entry);
  }
}

const safeInput = {
  eventType: "purchase_completed",
  actorAccountId: "account-customer-001",
  targetType: "order",
  targetId: "order-001",
  description: "Customer purchase completed.",
  metadata: {
    tokenAmount: 24,
    source: "unit_test",
  },
  transactionGroupId: "transaction-purchase-001",
} as const;

describe("AppendOnlyAuditService", () => {
  it("appends new records without exposing a mutation path", async () => {
    const repository = new InMemoryAuditLogRepository();
    let idSequence = 0;
    const service = new AppendOnlyAuditService({
      repository,
      generateId: () => `audit-${++idSequence}`,
      now: () => "2026-07-25T02:00:00.000Z",
    });

    const first = await service.append(safeInput);
    const second = await service.append({
      ...safeInput,
      targetId: "order-002",
    });

    expect(repository.records).toEqual([first, second]);
    expect(repository.records.map((record) => record.id)).toEqual([
      "audit-1",
      "audit-2",
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.metadata)).toBe(true);
  });

  it("rejects sensitive metadata at any nesting depth", () => {
    expect(() =>
      prepareAuditLog(
        {
          ...safeInput,
          metadata: {
            safeContext: {
              pinValue: "redacted",
            },
          },
        },
        {
          id: "audit-sensitive",
          occurredAt: "2026-07-25T02:00:00.000Z",
        },
      ),
    ).toThrow(SensitiveAuditMetadataError);
  });
});
