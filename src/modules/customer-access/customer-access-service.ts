import { prepareAuditLog } from "@/modules/audit-logs";
import type { Customer } from "@/modules/customers";
import type {
  RepositoryTransactionRunner,
  TransactionClock,
  TransactionIdProvider,
} from "@/modules/transactions";
import { domainIdSchema, publicCodeSchema } from "@/shared/validation";

import {
  buildPrivateAccountPath,
  generateCustomerAccessCode,
} from "./customer-access-code";
import type { ClaimedPrivateAccountReadModel } from "./customer-access-read-model";
import {
  assertAdministrator,
  CustomerAccessDataUnavailableError,
  CustomerAccessDeniedError,
  requireAccessCredentials,
  type CustomerAccessMutationRepositories,
} from "./customer-access-query";

export type CustomerAccessServiceTransactionRunner =
  RepositoryTransactionRunner<CustomerAccessMutationRepositories>;

export interface CustomerAccessServiceDependencies {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly transactionRunner: CustomerAccessServiceTransactionRunner;
}

export class ClaimQrExpiredError extends Error {
  public readonly code = "CLAIM_QR_EXPIRED";

  public constructor() {
    super("This claim QR has expired.");
    this.name = "ClaimQrExpiredError";
  }
}

export class ClaimQrAlreadyUsedError extends Error {
  public readonly code = "CLAIM_QR_ALREADY_USED";

  public constructor() {
    super("This claim QR has already been used.");
    this.name = "ClaimQrAlreadyUsedError";
  }
}

const claimExpiryMinutes = 15;

function parsePublicCodeInput(
  input: unknown,
  error: Error = new CustomerAccessDeniedError(),
): string {
  const parsed = publicCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw error;
  }

  return parsed.data;
}

function findCustomerByClaimCode(
  customers: readonly Customer[],
  claimCode: string,
): Customer | null {
  return (
    customers.find((candidate) => candidate.claimCode === claimCode) ?? null
  );
}

function findCustomerByPrivateAccessCode(
  customers: readonly Customer[],
  privateAccessCode: string,
): Customer | null {
  return (
    customers.find(
      (candidate) => candidate.privateAccessCode === privateAccessCode,
    ) ?? null
  );
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}

export class CustomerAccessService {
  public constructor(
    private readonly dependencies: CustomerAccessServiceDependencies,
  ) {}

  public claim(
    claimCodeInput: unknown,
  ): Promise<ClaimedPrivateAccountReadModel> {
    const claimCode = parsePublicCodeInput(claimCodeInput);

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const now = this.dependencies.clock.now();
      const customers = await repositories.customers.list();
      const customer = findCustomerByClaimCode(customers, claimCode);

      if (customer === null) {
        throw new CustomerAccessDeniedError();
      }
      const credentials = requireAccessCredentials(customer);

      if (credentials.claimedAt !== null) {
        throw new ClaimQrAlreadyUsedError();
      }

      if (Date.parse(credentials.claimExpiresAt) <= Date.parse(now)) {
        throw new ClaimQrExpiredError();
      }

      const account = await repositories.accounts.getById(customer.accountId);
      if (account === null || account.status !== "active") {
        throw new CustomerAccessDeniedError();
      }

      const updatedCustomer = Object.freeze({
        ...customer,
        claimedAt: now,
        updatedAt: now,
      });

      await repositories.customers.update(updatedCustomer);
      await repositories.auditLogs.append(
        prepareAuditLog(
          {
            eventType: "customer_claim_qr_claimed",
            actorAccountId: account.id,
            targetType: "customer",
            targetId: customer.id,
            description:
              "One-time customer claim QR was redeemed for a private account link.",
            metadata: {
              prototypeAccessFlow: "one_time_claim",
            },
            transactionGroupId: null,
          },
          {
            id: this.dependencies.idProvider.generateId("audit-log"),
            occurredAt: now,
          },
        ),
      );

      return Object.freeze({
        displayName: account.displayName,
        privateAccountPath: buildPrivateAccountPath(
          credentials.privateAccessCode,
        ),
      });
    });
  }

  public regenerateWalletQr(privateAccessCodeInput: unknown): Promise<string> {
    const privateAccessCode = parsePublicCodeInput(privateAccessCodeInput);

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const now = this.dependencies.clock.now();
      const customers = await repositories.customers.list();
      const customer = findCustomerByPrivateAccessCode(
        customers,
        privateAccessCode,
      );

      if (customer === null) {
        throw new CustomerAccessDeniedError();
      }
      requireAccessCredentials(customer);

      const nextPublicCode = generateCustomerAccessCode("cus");
      const updatedCustomer = Object.freeze({
        ...customer,
        publicCode: nextPublicCode,
        walletQrUpdatedAt: now,
        updatedAt: now,
      });

      await repositories.customers.update(updatedCustomer);
      await repositories.auditLogs.append(
        prepareAuditLog(
          {
            eventType: "customer_wallet_qr_regenerated",
            actorAccountId: customer.accountId,
            targetType: "customer",
            targetId: customer.id,
            description:
              "Customer regenerated the vendor-facing wallet QR code.",
            metadata: {
              prototypeAccessFlow: "wallet_qr_regeneration",
            },
            transactionGroupId: null,
          },
          {
            id: this.dependencies.idProvider.generateId("audit-log"),
            occurredAt: now,
          },
        ),
      );

      return nextPublicCode;
    });
  }

  public refreshClaimQr(
    actorAccountIdInput: unknown,
    customerIdInput: unknown,
  ): Promise<string> {
    const actorAccountId = domainIdSchema.parse(actorAccountIdInput);
    const customerId = domainIdSchema.parse(customerIdInput);

    return this.dependencies.transactionRunner.run(async (repositories) => {
      await assertAdministrator(actorAccountId, repositories);
      const customer = await repositories.customers.getById(customerId);

      if (customer === null) {
        throw new CustomerAccessDataUnavailableError();
      }

      const now = this.dependencies.clock.now();
      const nextClaimCode = generateCustomerAccessCode("claim");
      const updatedCustomer = Object.freeze({
        ...customer,
        claimCode: nextClaimCode,
        claimExpiresAt: addMinutes(now, claimExpiryMinutes),
        claimedAt: null,
        updatedAt: now,
      });

      await repositories.customers.update(updatedCustomer);
      return nextClaimCode;
    });
  }
}
