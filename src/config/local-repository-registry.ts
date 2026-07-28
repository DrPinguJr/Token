import {
  IndexedDbAccountRepository,
  type AccountPinCredentialRepository,
  type AccountRepository,
} from "@/modules/accounts";
import {
  IndexedDbAuditLogRepository,
  type AuditLogRepository,
} from "@/modules/audit-logs";
import {
  IndexedDbCustomerRepository,
  type CustomerRepository,
} from "@/modules/customers";
import {
  IndexedDbEventSettingsRepository,
  type EventSettingsRepository,
} from "@/modules/event-settings";
import {
  IndexedDbEvidenceRepository,
  type EvidenceRepository,
} from "@/modules/evidence";
import {
  IndexedDbOrderRepository,
  type OrderRepository,
} from "@/modules/orders";
import {
  IndexedDbProductRepository,
  type ProductRepository,
} from "@/modules/products";
import {
  IndexedDbRefundRepository,
  type RefundRepository,
} from "@/modules/refunds";
import {
  IndexedDbSettlementRepository,
  type SettlementRepository,
} from "@/modules/settlements";
import {
  IndexedDbTokenIssuanceRepository,
  type TokenIssuanceRepository,
} from "@/modules/token-issuance";
import {
  IndexedDbLedgerEntryRepository,
  type LedgerEntryRepository,
} from "@/modules/transactions";
import {
  IndexedDbVendorRepository,
  type VendorRepository,
} from "@/modules/vendors";
import {
  IndexedDbWalletRepository,
  type WalletRepository,
} from "@/modules/wallets";
import type { TokenlyPersistenceSource } from "@/shared/data";

export interface LocalRepositoryRegistry {
  readonly accountPinCredentials: AccountPinCredentialRepository;
  readonly accounts: AccountRepository;
  readonly auditLogs: AuditLogRepository;
  readonly customers: CustomerRepository;
  readonly eventSettings: EventSettingsRepository;
  readonly evidence: EvidenceRepository;
  readonly ledgerEntries: LedgerEntryRepository;
  readonly orders: OrderRepository;
  readonly products: ProductRepository;
  readonly refunds: RefundRepository;
  readonly settlements: SettlementRepository;
  readonly tokenIssuances: TokenIssuanceRepository;
  readonly vendors: VendorRepository;
  readonly wallets: WalletRepository;
}

/**
 * Internal composition boundary. Feature services receive only the returned
 * repository interfaces, never the IndexedDB source used to bind them.
 */
export function createLocalRepositoryRegistry(
  source: TokenlyPersistenceSource,
): LocalRepositoryRegistry {
  const accounts = new IndexedDbAccountRepository(source);

  return {
    accountPinCredentials: accounts,
    accounts,
    auditLogs: new IndexedDbAuditLogRepository(source),
    customers: new IndexedDbCustomerRepository(source),
    eventSettings: new IndexedDbEventSettingsRepository(source),
    evidence: new IndexedDbEvidenceRepository(source),
    ledgerEntries: new IndexedDbLedgerEntryRepository(source),
    orders: new IndexedDbOrderRepository(source),
    products: new IndexedDbProductRepository(source),
    refunds: new IndexedDbRefundRepository(source),
    settlements: new IndexedDbSettlementRepository(source),
    tokenIssuances: new IndexedDbTokenIssuanceRepository(source),
    vendors: new IndexedDbVendorRepository(source),
    wallets: new IndexedDbWalletRepository(source),
  };
}
