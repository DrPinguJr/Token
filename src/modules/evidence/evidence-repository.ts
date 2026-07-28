import type { Evidence, EvidenceId, EvidenceQuery } from "./evidence";

export interface EvidenceRepository {
  getById(id: EvidenceId): Promise<Evidence | null>;
  getContentById(id: EvidenceId): Promise<Blob | null>;
  list(query?: EvidenceQuery): Promise<readonly Evidence[]>;
  create(evidence: Evidence, content: Blob): Promise<void>;
}
