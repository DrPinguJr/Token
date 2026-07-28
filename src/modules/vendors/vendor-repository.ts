import type { Vendor, VendorId, VendorQuery } from "./vendor";

export interface VendorRepository {
  getById(id: VendorId): Promise<Vendor | null>;
  getByAccountId(accountId: string): Promise<Vendor | null>;
  getByWalletId(walletId: string): Promise<Vendor | null>;
  getByPublicCode(publicCode: string): Promise<Vendor | null>;
  list(query?: VendorQuery): Promise<readonly Vendor[]>;
  create(vendor: Vendor): Promise<void>;
  update(vendor: Vendor): Promise<void>;
}
