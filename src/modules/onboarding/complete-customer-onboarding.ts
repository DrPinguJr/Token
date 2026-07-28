import type { AccountRepository } from "@/modules/accounts";
import { prepareAuditLog, type AuditLogRepository } from "@/modules/audit-logs";
import { customerSchema, type CustomerRepository } from "@/modules/customers";
import type {
  RepositoryTransactionRunner,
  TransactionClock,
  TransactionIdProvider,
} from "@/modules/transactions";

import {
  completeCustomerOnboardingCommandSchema,
  type CompleteCustomerOnboardingCommand,
} from "./complete-customer-onboarding-schema";
import { CustomerOnboardingServiceError } from "./customer-onboarding-service-error";

export interface CustomerOnboardingTransactionRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly auditLogs: Pick<AuditLogRepository, "append">;
  readonly customers: Pick<CustomerRepository, "getByAccountId" | "update">;
}

export interface CompleteCustomerOnboardingDependencies {
  readonly clock: TransactionClock;
  readonly idProvider: TransactionIdProvider;
  readonly isDevelopmentToolsEnabled: () => boolean;
  readonly transactionRunner: RepositoryTransactionRunner<CustomerOnboardingTransactionRepositories>;
}

export interface CustomerOnboardingReceipt {
  readonly customerId: string;
  readonly completedAt: string;
  readonly status: "completed" | "already-completed";
}

function assertDevelopmentSkipIsEnabled(
  command: CompleteCustomerOnboardingCommand,
  dependencies: CompleteCustomerOnboardingDependencies,
): void {
  if (
    command.completionMethod === "development_skip" &&
    !dependencies.isDevelopmentToolsEnabled()
  ) {
    throw new CustomerOnboardingServiceError(
      "ONBOARDING_DEVELOPMENT_SKIP_DISABLED",
    );
  }
}

export class CompleteCustomerOnboardingService {
  public constructor(
    private readonly dependencies: CompleteCustomerOnboardingDependencies,
  ) {}

  public async complete(
    input: CompleteCustomerOnboardingCommand,
  ): Promise<CustomerOnboardingReceipt> {
    const command = completeCustomerOnboardingCommandSchema.parse(input);
    assertDevelopmentSkipIsEnabled(command, this.dependencies);

    const completedAt = this.dependencies.clock.now();
    const auditLogId = this.dependencies.idProvider.generateId("audit-log");

    return this.dependencies.transactionRunner.run(async (repositories) => {
      const account = await repositories.accounts.getById(
        command.actorAccountId,
      );

      if (
        account === null ||
        account.status !== "active" ||
        account.role !== "customer"
      ) {
        throw new CustomerOnboardingServiceError(
          "ONBOARDING_ACCOUNT_NOT_AUTHORIZED",
        );
      }

      const customer = await repositories.customers.getByAccountId(account.id);

      if (customer === null) {
        throw new CustomerOnboardingServiceError(
          "ONBOARDING_CUSTOMER_NOT_FOUND",
        );
      }

      if (customer.onboardingCompletedAt !== null) {
        return Object.freeze({
          customerId: customer.id,
          completedAt: customer.onboardingCompletedAt,
          status: "already-completed",
        });
      }

      const updatedCustomer = Object.freeze(
        customerSchema.parse({
          ...customer,
          onboardingCompletedAt: completedAt,
          updatedAt: completedAt,
        }),
      );
      const auditLog = prepareAuditLog(
        {
          eventType: "onboarding_completed",
          actorAccountId: account.id,
          targetType: "customer",
          targetId: customer.id,
          description: "Customer onboarding completed.",
          metadata: {
            completionMethod: command.completionMethod,
          },
          transactionGroupId: null,
        },
        {
          id: auditLogId,
          occurredAt: completedAt,
        },
      );

      await repositories.customers.update(updatedCustomer);
      await repositories.auditLogs.append(auditLog);

      return Object.freeze({
        customerId: customer.id,
        completedAt,
        status: "completed",
      });
    });
  }
}
