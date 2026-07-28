import {
  PinVerificationService,
  type PinVerificationTransactionRepositories,
} from "@/modules/authentication";
import {
  cryptoTransactionIdProvider,
  systemTransactionClock,
  type RepositoryTransactionRunner,
} from "@/modules/transactions";

import { runInLocalRepositoryTransaction } from "./local-repositories";

function createPinTransactionRunner(): RepositoryTransactionRunner<PinVerificationTransactionRepositories> {
  return {
    run<Result>(
      work: (
        repositories: PinVerificationTransactionRepositories,
      ) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

/**
 * Browser-local composition for the replaceable PIN abstraction. Production
 * must replace this simulator with server-side credential verification and
 * throttling.
 */
export function createLocalPinVerificationService(): PinVerificationService {
  return new PinVerificationService({
    clock: systemTransactionClock,
    idProvider: cryptoTransactionIdProvider,
    transactionRunner: createPinTransactionRunner(),
  });
}
