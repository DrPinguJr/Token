import type { AccountRepository } from "@/modules/accounts";
import type { Customer, CustomerRepository } from "@/modules/customers";
import { domainIdSchema } from "@/shared/validation";

export interface CustomerQrAccessRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
}

export class CustomerQrAccessDeniedError extends Error {
  public readonly code = "CUSTOMER_QR_ACCESS_DENIED";

  public constructor() {
    super("The current account cannot use this customer QR capability.");
    this.name = "CustomerQrAccessDeniedError";
  }
}

export async function resolveActiveCustomerForQr(
  actorAccountIdInput: unknown,
  repositories: CustomerQrAccessRepositories,
): Promise<Customer> {
  const actorAccountId = domainIdSchema.safeParse(actorAccountIdInput);

  if (!actorAccountId.success) {
    throw new CustomerQrAccessDeniedError();
  }

  const account = await repositories.accounts.getById(actorAccountId.data);

  if (
    account === null ||
    account.status !== "active" ||
    account.role !== "customer"
  ) {
    throw new CustomerQrAccessDeniedError();
  }

  const customer = await repositories.customers.getByAccountId(account.id);

  if (customer === null) {
    throw new CustomerQrAccessDeniedError();
  }

  return customer;
}
