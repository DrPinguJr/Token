import type { Customer, CustomerId, CustomerQuery } from "./customer";

export interface CustomerRepository {
  getById(id: CustomerId): Promise<Customer | null>;
  getByAccountId(accountId: string): Promise<Customer | null>;
  getByWalletId(walletId: string): Promise<Customer | null>;
  getByPublicCode(publicCode: string): Promise<Customer | null>;
  list(query?: CustomerQuery): Promise<readonly Customer[]>;
  create(customer: Customer): Promise<void>;
  update(customer: Customer): Promise<void>;
}
