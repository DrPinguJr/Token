import type { JsonObject, JsonValue } from "@/shared/types";

import { auditLogSchema } from "./audit-log-schema";
import type { AuditLog } from "./audit-log";
import type { AuditLogRepository } from "./audit-log-repository";

export type AppendAuditLogInput = Readonly<Omit<AuditLog, "id" | "occurredAt">>;

export interface AuditRecordIdentity {
  readonly id: string;
  readonly occurredAt: string;
}

export interface AppendOnlyAuditServiceDependencies {
  readonly repository: AuditLogRepository;
  readonly generateId: () => string;
  readonly now: () => string;
}

export class SensitiveAuditMetadataError extends Error {
  readonly code = "SENSITIVE_AUDIT_METADATA";

  constructor(readonly metadataPath: string) {
    super(`Audit metadata contains a forbidden field at ${metadataPath}.`);
    this.name = "SensitiveAuditMetadataError";
  }
}

const forbiddenMetadataSegments = new Set([
  "credential",
  "credentials",
  "passcode",
  "password",
  "pin",
  "secret",
  "secrets",
]);

const forbiddenMetadataKeys = new Set([
  "binary_content",
  "evidence_bytes",
  "evidence_content",
  "private_key",
]);

function normaliseMetadataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase();
}

function isJsonValueArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function assertSafeMetadataValue(value: JsonValue, path: string): void {
  if (isJsonValueArray(value)) {
    value.forEach((item, index) => {
      assertSafeMetadataValue(item, `${path}[${index}]`);
    });
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  assertSafeAuditMetadata(value, path);
}

function deepFreezeJsonValue(value: JsonValue): void {
  if (isJsonValueArray(value)) {
    value.forEach(deepFreezeJsonValue);
    Object.freeze(value);
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  Object.values(value).forEach(deepFreezeJsonValue);
  Object.freeze(value);
}

export function assertSafeAuditMetadata(
  metadata: JsonObject,
  path = "metadata",
): void {
  for (const [key, value] of Object.entries(metadata)) {
    const normalisedKey = normaliseMetadataKey(key);
    const segments = normalisedKey.split("_");

    if (
      forbiddenMetadataKeys.has(normalisedKey) ||
      segments.some((segment) => forbiddenMetadataSegments.has(segment))
    ) {
      throw new SensitiveAuditMetadataError(`${path}.${key}`);
    }

    assertSafeMetadataValue(value, `${path}.${key}`);
  }
}

/**
 * Builds and validates an immutable audit record without persisting it.
 *
 * Multi-store transaction services can use this function to include the audit
 * record in the same IndexedDB transaction as the related business records.
 */
export function prepareAuditLog(
  input: AppendAuditLogInput,
  identity: AuditRecordIdentity,
): AuditLog {
  assertSafeAuditMetadata(input.metadata);

  const record = auditLogSchema.parse({
    ...input,
    ...identity,
  });

  deepFreezeJsonValue(record.metadata);
  return Object.freeze(record);
}

/**
 * Append-only audit facade. It deliberately exposes no update or delete path.
 */
export class AppendOnlyAuditService {
  constructor(
    private readonly dependencies: AppendOnlyAuditServiceDependencies,
  ) {}

  async append(input: AppendAuditLogInput): Promise<AuditLog> {
    const record = prepareAuditLog(input, {
      id: this.dependencies.generateId(),
      occurredAt: this.dependencies.now(),
    });

    await this.dependencies.repository.append(record);

    return record;
  }
}
