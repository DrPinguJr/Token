import type { Settlement, SettlementId, SettlementQuery } from "./settlement";

export interface SettlementRepository {
  getById(id: SettlementId): Promise<Settlement | null>;
  getByReference(reference: string): Promise<Settlement | null>;
  list(query?: SettlementQuery): Promise<readonly Settlement[]>;
  create(settlement: Settlement): Promise<void>;
  update(settlement: Settlement): Promise<void>;
}
