import {
  addStoredRecord,
  getAllStoredRecords,
  getStoredRecord,
  getStoredRecordFromIndex,
  newestFirst,
  replaceStoredRecord,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { Customer, CustomerId, CustomerQuery } from "./customer";
import type { CustomerRepository } from "./customer-repository";
import { customerQuerySchema, customerSchema } from "./customer-schema";

export class IndexedDbCustomerRepository implements CustomerRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: CustomerId): Promise<Customer | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.customers,
      id,
      customerSchema,
    );
  }

  public getByAccountId(accountId: string): Promise<Customer | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.customers,
      tokenlyIndexNames.customers.accountId,
      accountId,
      customerSchema,
    );
  }

  public getByWalletId(walletId: string): Promise<Customer | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.customers,
      tokenlyIndexNames.customers.walletId,
      walletId,
      customerSchema,
    );
  }

  public getByPublicCode(publicCode: string): Promise<Customer | null> {
    return getStoredRecordFromIndex(
      this.database,
      tokenlyStoreNames.customers,
      tokenlyIndexNames.customers.publicCode,
      publicCode,
      customerSchema,
    );
  }

  public async list(query?: CustomerQuery): Promise<readonly Customer[]> {
    const parsedQuery = customerQuerySchema.parse(query ?? {});
    const customers = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.customers,
      customerSchema,
    );

    return newestFirst(
      customers.filter(
        ({ onboardingCompletedAt }) =>
          parsedQuery.onboardingCompleted === undefined ||
          (onboardingCompletedAt !== null) === parsedQuery.onboardingCompleted,
      ),
      ({ createdAt }) => createdAt,
    );
  }

  public create(customer: Customer): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.customers,
      customerSchema,
      customer,
    );
  }

  public update(customer: Customer): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.customers,
      customerSchema,
      customer,
    );
  }
}
