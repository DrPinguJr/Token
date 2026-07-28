import type { CustomerQrAccessRepositories } from "./customer-qr-access";
import { resolveActiveCustomerForQr } from "./customer-qr-access";
import { buildTokenlyQrPayload } from "./tokenly-qr-payload";

export interface CustomerAccountQrReadModel {
  readonly customerId: string;
  readonly publicCode: string;
  readonly payload: string;
}

export class CustomerAccountQrQuery {
  public constructor(
    private readonly repositories: CustomerQrAccessRepositories,
  ) {}

  public async getForAccount(
    actorAccountId: unknown,
  ): Promise<CustomerAccountQrReadModel> {
    const customer = await resolveActiveCustomerForQr(
      actorAccountId,
      this.repositories,
    );

    return Object.freeze({
      customerId: customer.id,
      publicCode: customer.publicCode,
      payload: buildTokenlyQrPayload({
        version: 1,
        kind: "customer",
        publicCode: customer.publicCode,
      }),
    });
  }
}
