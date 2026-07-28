import {
  CompleteCustomerOnboardingService,
  type CustomerOnboardingTransactionRepositories,
} from "@/modules/onboarding";
import {
  cryptoTransactionIdProvider,
  systemTransactionClock,
  type RepositoryTransactionWork,
} from "@/modules/transactions";

import { areDevelopmentToolsEnabled } from "./development-tools";
import { runInLocalRepositoryTransaction } from "./local-repositories";

export function createConfiguredCustomerOnboardingService(): CompleteCustomerOnboardingService {
  return new CompleteCustomerOnboardingService({
    clock: systemTransactionClock,
    idProvider: cryptoTransactionIdProvider,
    isDevelopmentToolsEnabled: areDevelopmentToolsEnabled,
    transactionRunner: {
      run: <Result>(
        work: RepositoryTransactionWork<
          CustomerOnboardingTransactionRepositories,
          Result
        >,
      ) =>
        runInLocalRepositoryTransaction((repositories) => work(repositories)),
    },
  });
}
