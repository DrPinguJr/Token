import type {
  TokenIssuance,
  TokenIssuanceId,
  TokenIssuanceQuery,
} from "./token-issuance";

export interface TokenIssuanceRepository {
  getById(id: TokenIssuanceId): Promise<TokenIssuance | null>;
  getByReference(reference: string): Promise<TokenIssuance | null>;
  getByTransactionGroupId(
    transactionGroupId: string,
  ): Promise<TokenIssuance | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<TokenIssuance | null>;
  findByNormalizedPaymentReference(
    normalizedPaymentReference: string,
  ): Promise<readonly TokenIssuance[]>;
  list(query?: TokenIssuanceQuery): Promise<readonly TokenIssuance[]>;
  create(issuance: TokenIssuance): Promise<void>;
}
