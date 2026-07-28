import {
  CustomerAccessQuery,
  CustomerAccessService,
  type CustomerAccessMutationRepositories,
  type CustomerAccessMutationTransactionRunner,
  type CustomerAccessQueryRepositories,
  type CustomerAccessQueryTransactionRunner,
} from "@/modules/customer-access";
import {
  cryptoTransactionIdProvider,
  systemTransactionClock,
} from "@/modules/transactions";

import { runInLocalRepositoryTransaction } from "./local-repositories";

function createQueryTransactionRunner(): CustomerAccessQueryTransactionRunner {
  return {
    run<Result>(
      work: (repositories: CustomerAccessQueryRepositories) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

function createMutationTransactionRunner(): CustomerAccessMutationTransactionRunner {
  return {
    run<Result>(
      work: (
        repositories: CustomerAccessMutationRepositories,
      ) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

export function createConfiguredCustomerAccessQuery(): CustomerAccessQuery {
  return new CustomerAccessQuery(createQueryTransactionRunner());
}

export function createConfiguredCustomerAccessService(): CustomerAccessService {
  return new CustomerAccessService({
    clock: systemTransactionClock,
    idProvider: cryptoTransactionIdProvider,
    transactionRunner: createMutationTransactionRunner(),
  });
}
