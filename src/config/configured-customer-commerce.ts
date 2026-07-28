import {
  PinVerificationService,
  type PinVerificationTransactionRepositories,
} from "@/modules/authentication";
import {
  CustomerCommerceQuery,
  CustomerPurchaseService,
  type CustomerPaymentReviewQueryInput,
  type CustomerPaymentReviewReadModel,
  type CustomerPurchaseInput,
  type CustomerVendorStorefront,
  type CustomerVendorSummary,
} from "@/modules/customer-commerce";
import {
  PurchaseService,
  type PurchaseReceipt,
  type PurchaseTransactionRepositories,
} from "@/modules/orders";
import {
  cryptoTransactionGroupIdProvider,
  cryptoTransactionIdProvider,
  cryptoTransactionReferenceProvider,
  systemTransactionClock,
  type RepositoryTransactionRunner,
} from "@/modules/transactions";

import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type CreateLocalRepositoriesOptions,
} from "./local-repositories";

export interface ConfiguredCustomerCommerceGateway {
  listVendorDirectory(): Promise<readonly CustomerVendorSummary[]>;
  getVendorStorefront(
    vendorId: string,
  ): Promise<CustomerVendorStorefront | null>;
  getPaymentReview(
    input: CustomerPaymentReviewQueryInput,
  ): Promise<CustomerPaymentReviewReadModel>;
  completePurchase(input: CustomerPurchaseInput): Promise<PurchaseReceipt>;
}

export type ConfiguredCustomerCommerceOptions = CreateLocalRepositoriesOptions;

function createPinTransactionRunner(
  options: ConfiguredCustomerCommerceOptions,
): RepositoryTransactionRunner<PinVerificationTransactionRepositories> {
  return {
    run: <Result>(
      work: (
        repositories: PinVerificationTransactionRepositories,
      ) => Promise<Result>,
    ): Promise<Result> =>
      runInLocalRepositoryTransaction(
        (repositories) => work(repositories),
        options,
      ),
  };
}

function createPurchaseTransactionRunner(
  options: ConfiguredCustomerCommerceOptions,
): RepositoryTransactionRunner<PurchaseTransactionRepositories> {
  return {
    run: <Result>(
      work: (repositories: PurchaseTransactionRepositories) => Promise<Result>,
    ): Promise<Result> =>
      runInLocalRepositoryTransaction(
        (repositories) => work(repositories),
        options,
      ),
  };
}

function createConfiguredCustomerPurchaseService(
  options: ConfiguredCustomerCommerceOptions,
): CustomerPurchaseService {
  const pinVerificationService = new PinVerificationService({
    clock: systemTransactionClock,
    idProvider: cryptoTransactionIdProvider,
    transactionRunner: createPinTransactionRunner(options),
  });
  const purchaseService = new PurchaseService({
    clock: systemTransactionClock,
    idProvider: cryptoTransactionIdProvider,
    referenceProvider: cryptoTransactionReferenceProvider,
    transactionGroupIdProvider: cryptoTransactionGroupIdProvider,
    transactionRunner: createPurchaseTransactionRunner(options),
  });

  return new CustomerPurchaseService({
    pinVerificationService,
    purchaseService,
  });
}

async function createConfiguredCustomerCommerceQuery(
  options: ConfiguredCustomerCommerceOptions,
): Promise<CustomerCommerceQuery> {
  // The runtime/reset composition owns the shared cached connection lifecycle.
  // Per-query close calls would invalidate the runtime's active handles.
  const repositories = await createLocalRepositories(options);

  return new CustomerCommerceQuery({
    accounts: repositories.accounts,
    customers: repositories.customers,
    ledgerEntries: repositories.ledgerEntries,
    products: repositories.products,
    vendors: repositories.vendors,
    wallets: repositories.wallets,
  });
}

export function createConfiguredCustomerCommerceGateway(
  options: ConfiguredCustomerCommerceOptions = {},
): ConfiguredCustomerCommerceGateway {
  return Object.freeze({
    listVendorDirectory: async () =>
      (
        await createConfiguredCustomerCommerceQuery(options)
      ).listVendorDirectory(),
    getVendorStorefront: async (vendorId: string) =>
      (
        await createConfiguredCustomerCommerceQuery(options)
      ).getVendorStorefront({ vendorId }),
    getPaymentReview: async (input: CustomerPaymentReviewQueryInput) =>
      (await createConfiguredCustomerCommerceQuery(options)).getPaymentReview(
        input,
      ),
    completePurchase: (input: CustomerPurchaseInput) =>
      createConfiguredCustomerPurchaseService(options).completePurchase(input),
  });
}
