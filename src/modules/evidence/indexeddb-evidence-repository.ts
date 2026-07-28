import { z } from "zod";

import {
  addStoredRecord,
  getAllStoredRecords,
  getStoredRecord,
  isTokenlyReadWriteTransaction,
  isWithinUtcRange,
  newestFirst,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";
import { domainIdSchema } from "@/shared/validation";

import type { Evidence, EvidenceId, EvidenceQuery } from "./evidence";
import type { EvidenceRepository } from "./evidence-repository";
import { evidenceQuerySchema, evidenceSchema } from "./evidence-schema";

const evidenceContentSchema = z
  .object({
    id: domainIdSchema,
    evidenceId: domainIdSchema,
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    content: z.custom<Blob>(
      (value): value is Blob =>
        typeof value === "object" &&
        value !== null &&
        Object.prototype.toString.call(value) === "[object Blob]" &&
        "size" in value &&
        typeof value.size === "number" &&
        "type" in value &&
        typeof value.type === "string" &&
        "slice" in value &&
        typeof value.slice === "function",
      "Evidence content must be a Blob.",
    ),
  })
  .strict();

type EvidenceContent = z.infer<typeof evidenceContentSchema>;

export class EvidenceContentValidationError extends Error {
  public readonly code = "EVIDENCE_CONTENT_INVALID";

  public constructor() {
    super("Local evidence content does not match its validated metadata.");
    this.name = "EvidenceContentValidationError";
  }
}

export class IndexedDbEvidenceRepository implements EvidenceRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: EvidenceId): Promise<Evidence | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.evidence,
      id,
      evidenceSchema,
    );
  }

  public async getContentById(id: EvidenceId): Promise<Blob | null> {
    const evidence = await this.getById(id);
    if (evidence === null) {
      return null;
    }

    const storedContent = await getStoredRecord(
      this.database,
      tokenlyStoreNames.evidenceContents,
      evidence.localBlobKey,
      evidenceContentSchema,
    );
    if (storedContent === null) {
      return null;
    }

    if (storedContent.evidenceId !== evidence.id) {
      throw new EvidenceContentValidationError();
    }

    if (
      storedContent.content.size !== evidence.sizeBytes ||
      storedContent.content.type !== evidence.mimeType ||
      storedContent.mimeType !== evidence.mimeType
    ) {
      throw new EvidenceContentValidationError();
    }

    return storedContent.content.slice(
      0,
      storedContent.content.size,
      storedContent.mimeType,
    );
  }

  public async list(query?: EvidenceQuery): Promise<readonly Evidence[]> {
    const parsedQuery = evidenceQuerySchema.parse(query ?? {});
    const evidenceRecords = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.evidence,
      evidenceSchema,
    );

    return newestFirst(
      evidenceRecords.filter(
        (evidence) =>
          (parsedQuery.kind === undefined ||
            evidence.kind === parsedQuery.kind) &&
          (parsedQuery.capturedByAccountId === undefined ||
            evidence.capturedByAccountId === parsedQuery.capturedByAccountId) &&
          isWithinUtcRange(
            evidence.createdAt,
            parsedQuery.fromCreatedAt,
            parsedQuery.toCreatedAt,
          ),
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public async create(evidence: Evidence, content: Blob): Promise<void> {
    const parsedEvidence = evidenceSchema.parse(evidence);

    if (
      content.size !== parsedEvidence.sizeBytes ||
      content.type !== parsedEvidence.mimeType
    ) {
      throw new EvidenceContentValidationError();
    }

    const storedContent = evidenceContentSchema.parse({
      id: parsedEvidence.localBlobKey,
      evidenceId: parsedEvidence.id,
      mimeType: parsedEvidence.mimeType,
      content,
    });

    if (isTokenlyReadWriteTransaction(this.database)) {
      await this.addEvidenceRecords(
        this.database,
        parsedEvidence,
        storedContent,
      );
      return;
    }

    const transaction = this.database.transaction(
      [tokenlyStoreNames.evidence, tokenlyStoreNames.evidenceContents],
      "readwrite",
    );

    try {
      await this.addEvidenceRecords(transaction, parsedEvidence, storedContent);
      await transaction.done;
    } catch (error: unknown) {
      await transaction.done.catch(() => undefined);
      throw error;
    }
  }

  private async addEvidenceRecords(
    source: TokenlyPersistenceSource,
    evidence: Evidence,
    storedContent: EvidenceContent,
  ): Promise<void> {
    await Promise.all([
      addStoredRecord(
        source,
        tokenlyStoreNames.evidence,
        evidenceSchema,
        evidence,
      ),
      addStoredRecord(
        source,
        tokenlyStoreNames.evidenceContents,
        evidenceContentSchema,
        storedContent,
      ),
    ]);
  }
}
