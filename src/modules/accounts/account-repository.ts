import type {
  Account,
  AccountId,
  AccountPinCredential,
  AccountQuery,
  AccountSummary,
} from "./account";

/**
 * General account access. All returned records are credential-free summaries.
 */
export interface AccountRepository {
  getById(id: AccountId): Promise<AccountSummary | null>;
  getByMobileNumber(
    normalizedMobileNumber: string,
  ): Promise<AccountSummary | null>;
  list(query?: AccountQuery): Promise<readonly AccountSummary[]>;
  create(
    account: Account,
    initialPinCredential: AccountPinCredential,
  ): Promise<void>;
  update(account: Account): Promise<void>;
}

/**
 * Credential-only access for PinVerificationService.
 *
 * Keep this dependency separate from AccountRepository so ordinary account
 * queries cannot read credential or lockout state.
 */
export interface AccountPinCredentialRepository {
  getPinCredentialByAccountId(
    accountId: AccountId,
  ): Promise<AccountPinCredential | null>;
  updatePinCredential(credential: AccountPinCredential): Promise<void>;
}
