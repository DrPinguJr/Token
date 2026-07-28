export type RepositoryTransactionWork<Repositories, Result> = (
  repositories: Repositories,
) => Promise<Result>;

/**
 * Runs all repository reads and writes for one value-changing operation inside
 * the same persistence transaction.
 */
export interface RepositoryTransactionRunner<Repositories> {
  run<Result>(
    work: RepositoryTransactionWork<Repositories, Result>,
  ): Promise<Result>;
}
