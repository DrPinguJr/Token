import type { AccountRepository } from "@/modules/accounts";
import type { CustomerRepository } from "@/modules/customers";
import type { Product, ProductRepository } from "@/modules/products";
import type { LedgerEntryRepository } from "@/modules/transactions";
import type { Vendor, VendorRepository } from "@/modules/vendors";
import {
  calculateWalletBalance,
  type WalletRepository,
} from "@/modules/wallets";

import { CustomerCommerceError } from "./customer-commerce-error";
import {
  customerPaymentReviewQuerySchema,
  customerStorefrontQuerySchema,
} from "./customer-commerce-schema";
import type {
  CustomerPaymentReviewItem,
  CustomerPaymentReviewReadModel,
  CustomerProductReadModel,
  CustomerVendorStorefront,
  CustomerVendorSummary,
} from "./customer-commerce";

export interface CustomerCommerceQueryRepositories {
  readonly accounts: Pick<AccountRepository, "getById">;
  readonly customers: Pick<CustomerRepository, "getByAccountId">;
  readonly ledgerEntries: Pick<LedgerEntryRepository, "findByWalletId">;
  readonly products: Pick<ProductRepository, "getById" | "list">;
  readonly vendors: Pick<VendorRepository, "getById" | "list">;
  readonly wallets: Pick<WalletRepository, "getById">;
}

function isAvailableProduct(product: Product): boolean {
  return product.isAvailable && !product.isSoldOut && !product.isArchived;
}

function toProductReadModel(product: Product): CustomerProductReadModel {
  return Object.freeze({
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    tokenPrice: product.tokenPrice,
    category: product.category,
    displayOrder: product.displayOrder,
  });
}

function createVendorSummary(
  vendor: Vendor,
  products: readonly Product[],
): CustomerVendorSummary {
  const availableProducts = products.filter(
    (product) =>
      product.vendorId === vendor.id && isAvailableProduct(product),
  );

  return Object.freeze({
    id: vendor.id,
    displayName: vendor.displayName,
    description: vendor.description,
    stallLocation: vendor.stallLocation,
    operatingStatus: vendor.operatingStatus,
    logo: vendor.logo,
    banner: vendor.banner,
    availableProductCount: availableProducts.length,
    categories: Object.freeze(
      [...new Set(availableProducts.map(({ category }) => category))].sort(
        (left, right) => left.localeCompare(right, "en-SG"),
      ),
    ),
  });
}

function calculateLineTokenTotal(
  product: Product,
  quantity: number,
): number {
  if (quantity > Math.floor(Number.MAX_SAFE_INTEGER / product.tokenPrice)) {
    throw new CustomerCommerceError("CUSTOMER_COMMERCE_INVALID_QUERY");
  }

  return product.tokenPrice * quantity;
}

export class CustomerCommerceQuery {
  public constructor(
    private readonly repositories: CustomerCommerceQueryRepositories,
  ) {}

  public async listVendorDirectory(): Promise<
    readonly CustomerVendorSummary[]
  > {
    // Catalogue reads contain public vendor/product data. Customer route access
    // is enforced by the route layout; no wallet or account data is returned.
    const [vendors, products] = await Promise.all([
      this.repositories.vendors.list(),
      this.repositories.products.list({
        isAvailable: true,
        isSoldOut: false,
        isArchived: false,
      }),
    ]);

    return Object.freeze(
      vendors.map((vendor) => createVendorSummary(vendor, products)),
    );
  }

  public async getVendorStorefront(
    input: unknown,
  ): Promise<CustomerVendorStorefront | null> {
    const parsedInput = customerStorefrontQuerySchema.safeParse(input);

    if (!parsedInput.success) {
      throw new CustomerCommerceError("CUSTOMER_COMMERCE_INVALID_QUERY");
    }

    const [vendor, products] = await Promise.all([
      this.repositories.vendors.getById(parsedInput.data.vendorId),
      this.repositories.products.list({
        vendorId: parsedInput.data.vendorId,
        isAvailable: true,
        isSoldOut: false,
        isArchived: false,
      }),
    ]);

    if (vendor === null) {
      return null;
    }

    const availableProducts = products.filter(isAvailableProduct);

    return Object.freeze({
      vendor: createVendorSummary(vendor, availableProducts),
      products: Object.freeze(availableProducts.map(toProductReadModel)),
    });
  }

  public async getPaymentReview(
    input: unknown,
  ): Promise<CustomerPaymentReviewReadModel> {
    const parsedInput = customerPaymentReviewQuerySchema.safeParse(input);

    if (!parsedInput.success) {
      throw new CustomerCommerceError("CUSTOMER_COMMERCE_INVALID_QUERY");
    }

    const command = parsedInput.data;
    const [actorAccount, customer, vendor, ...products] = await Promise.all([
      this.repositories.accounts.getById(command.actorAccountId),
      this.repositories.customers.getByAccountId(command.actorAccountId),
      this.repositories.vendors.getById(command.vendorId),
      ...command.items.map(({ productId }) =>
        this.repositories.products.getById(productId),
      ),
    ]);

    if (
      actorAccount === null ||
      actorAccount.status !== "active" ||
      actorAccount.role !== "customer" ||
      customer === null ||
      customer.accountId !== actorAccount.id
    ) {
      throw new CustomerCommerceError(
        "CUSTOMER_COMMERCE_CUSTOMER_UNAVAILABLE",
      );
    }

    if (vendor === null) {
      throw new CustomerCommerceError(
        "CUSTOMER_COMMERCE_VENDOR_UNAVAILABLE",
      );
    }

    const wallet = await this.repositories.wallets.getById(customer.walletId);

    if (
      wallet === null ||
      wallet.status !== "active" ||
      wallet.ownerType !== "customer" ||
      wallet.ownerAccountId !== command.actorAccountId
    ) {
      throw new CustomerCommerceError("CUSTOMER_COMMERCE_WALLET_UNAVAILABLE");
    }

    const ledgerEntries =
      await this.repositories.ledgerEntries.findByWalletId(wallet.id);
    let customerBalance: number;

    try {
      customerBalance = calculateWalletBalance(ledgerEntries);
    } catch {
      throw new CustomerCommerceError(
        "CUSTOMER_COMMERCE_BALANCE_UNAVAILABLE",
      );
    }

    if (customerBalance < 0) {
      throw new CustomerCommerceError(
        "CUSTOMER_COMMERCE_BALANCE_UNAVAILABLE",
      );
    }

    let estimatedTokenTotal = 0;
    const reviewItems: CustomerPaymentReviewItem[] = [];

    command.items.forEach((item, index) => {
      const product = products[index];

      if (
        product === null ||
        product === undefined ||
        product.vendorId !== vendor.id ||
        !isAvailableProduct(product)
      ) {
        throw new CustomerCommerceError(
          "CUSTOMER_COMMERCE_PRODUCT_UNAVAILABLE",
        );
      }

      const lineTokenTotal = calculateLineTokenTotal(product, item.quantity);

      if (
        estimatedTokenTotal >
        Number.MAX_SAFE_INTEGER - lineTokenTotal
      ) {
        throw new CustomerCommerceError("CUSTOMER_COMMERCE_INVALID_QUERY");
      }

      estimatedTokenTotal += lineTokenTotal;
      reviewItems.push(
        Object.freeze({
          ...toProductReadModel(product),
          quantity: item.quantity,
          lineTokenTotal,
        }),
      );
    });

    reviewItems.sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.id.localeCompare(right.id, "en-SG"),
    );

    return Object.freeze({
      vendor: createVendorSummary(
        vendor,
        products.filter((product): product is Product => product !== null),
      ),
      customerBalance,
      items: Object.freeze(reviewItems),
      estimatedTokenTotal,
    });
  }
}
