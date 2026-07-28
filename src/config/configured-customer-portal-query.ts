import {
  CustomerPortalQuery,
  type CustomerPortalQueryRepositories,
  type CustomerPortalQueryTransactionRunner,
} from "@/modules/customer-application";

import { runInLocalRepositoryTransaction } from "./local-repositories";

function createCustomerPortalQueryTransactionRunner(): CustomerPortalQueryTransactionRunner {
  return {
    run<Result>(
      work: (repositories: CustomerPortalQueryRepositories) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

/**
 * Browser-local customer read composition. UI consumers receive query
 * capabilities only; repository interfaces remain inside this boundary.
 */
export function createConfiguredCustomerPortalQuery(): CustomerPortalQuery {
  return new CustomerPortalQuery(createCustomerPortalQueryTransactionRunner());
}
