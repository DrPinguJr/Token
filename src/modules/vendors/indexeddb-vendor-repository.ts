import {
  addStoredRecord,
  ascendingText,
  containsNormalizedSearch,
  getAllStoredRecords,
  getStoredRecord,
  getStoredRecordFromIndex,
  replaceStoredRecord,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { Vendor, VendorId, VendorQuery } from "./vendor";
import type { VendorRepository } from "./vendor-repository";
import { vendorQuerySchema, vendorSchema } from "./vendor-schema";

export class IndexedDbVendorRepository implements VendorRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: VendorId): Promise<Vendor | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.vendors,
      id,
      vendorSchema,
    );
  }

  public getByAccountId(accountId: string): Promise<Vendor | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.vendors,
      tokenlyIndexNames.vendors.accountId,
      accountId,
      vendorSchema,
    );
  }

  public getByWalletId(walletId: string): Promise<Vendor | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.vendors,
      tokenlyIndexNames.vendors.walletId,
      walletId,
      vendorSchema,
    );
  }

  public getByPublicCode(publicCode: string): Promise<Vendor | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.vendors,
      tokenlyIndexNames.vendors.publicCode,
      publicCode,
      vendorSchema,
    );
  }

  public async list(query?: VendorQuery): Promise<readonly Vendor[]> {
    const parsedQuery = vendorQuerySchema.parse(query ?? {});
    const vendors = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.vendors,
      vendorSchema,
    );

    return ascendingText(
      vendors.filter(
        (vendor) =>
          (parsedQuery.operatingStatus === undefined ||
            vendor.operatingStatus === parsedQuery.operatingStatus) &&
          (parsedQuery.search === undefined ||
            containsNormalizedSearch(parsedQuery.search, [
              vendor.displayName,
              vendor.description,
              vendor.stallLocation,
            ])),
      ),
      ({ displayName }) => displayName,
    );
  }

  public create(vendor: Vendor): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.vendors,
      vendorSchema,
      vendor,
    );
  }

  public update(vendor: Vendor): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.vendors,
      vendorSchema,
      vendor,
    );
  }
}
