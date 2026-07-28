import { z } from "zod";

import {
  addStoredRecord,
  getAllStoredRecords,
  getAllStoredRecordsFromIndex,
  getStoredRecord,
  replaceStoredRecord,
  tokenlyIndexNames,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { Product, ProductId, ProductQuery } from "./product";
import type { ProductRepository } from "./product-repository";
import { productQuerySchema, productSchema } from "./product-schema";

const indexedBooleanSchema = z.union([z.literal(0), z.literal(1)]);

const indexedProductRecordSchema = productSchema
  .extend({
    isAvailableIndex: indexedBooleanSchema,
    isSoldOutIndex: indexedBooleanSchema,
    isArchivedIndex: indexedBooleanSchema,
  })
  .strict()
  .superRefine((record, context) => {
    const expectedFlags = [
      ["isAvailableIndex", record.isAvailable],
      ["isSoldOutIndex", record.isSoldOut],
      ["isArchivedIndex", record.isArchived],
    ] as const;

    for (const [field, value] of expectedFlags) {
      if (record[field] !== Number(value)) {
        context.addIssue({
          code: "custom",
          message: `${field} does not match its product state.`,
          path: [field],
        });
      }
    }
  });

type IndexedProductRecord = z.infer<typeof indexedProductRecordSchema>;

function toIndexedProductRecord(product: Product): IndexedProductRecord {
  return indexedProductRecordSchema.parse({
    ...product,
    isAvailableIndex: Number(product.isAvailable),
    isSoldOutIndex: Number(product.isSoldOut),
    isArchivedIndex: Number(product.isArchived),
  });
}

function toProduct(record: IndexedProductRecord): Product {
  return productSchema.parse({
    id: record.id,
    vendorId: record.vendorId,
    name: record.name,
    description: record.description,
    image: record.image,
    tokenPrice: record.tokenPrice,
    category: record.category,
    isAvailable: record.isAvailable,
    isSoldOut: record.isSoldOut,
    isArchived: record.isArchived,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export class IndexedDbProductRepository implements ProductRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public getById(id: ProductId): Promise<Product | null> {
    return getStoredRecord(
      this.database,
      tokenlyStoreNames.products,
      id,
      indexedProductRecordSchema,
    ).then((record) => (record === null ? null : toProduct(record)));
  }

  public async list(query?: ProductQuery): Promise<readonly Product[]> {
    const parsedQuery = productQuerySchema.parse(query ?? {});
    let storedProducts: IndexedProductRecord[];

    if (
      parsedQuery.vendorId !== undefined &&
      parsedQuery.isArchived !== undefined
    ) {
      storedProducts = await getAllStoredRecordsFromIndex(
        this.database,
        tokenlyStoreNames.products,
        tokenlyIndexNames.products.vendorAndArchived,
        [parsedQuery.vendorId, Number(parsedQuery.isArchived)],
        indexedProductRecordSchema,
      );
    } else if (
      parsedQuery.vendorId !== undefined &&
      parsedQuery.isAvailable !== undefined
    ) {
      storedProducts = await getAllStoredRecordsFromIndex(
        this.database,
        tokenlyStoreNames.products,
        tokenlyIndexNames.products.vendorAndAvailability,
        [parsedQuery.vendorId, Number(parsedQuery.isAvailable)],
        indexedProductRecordSchema,
      );
    } else if (
      parsedQuery.vendorId !== undefined &&
      parsedQuery.isSoldOut !== undefined
    ) {
      storedProducts = await getAllStoredRecordsFromIndex(
        this.database,
        tokenlyStoreNames.products,
        tokenlyIndexNames.products.vendorAndSoldOut,
        [parsedQuery.vendorId, Number(parsedQuery.isSoldOut)],
        indexedProductRecordSchema,
      );
    } else if (parsedQuery.vendorId !== undefined) {
      storedProducts = await getAllStoredRecordsFromIndex(
        this.database,
        tokenlyStoreNames.products,
        tokenlyIndexNames.products.vendorId,
        parsedQuery.vendorId,
        indexedProductRecordSchema,
      );
    } else {
      storedProducts = await getAllStoredRecords(
        this.database,
        tokenlyStoreNames.products,
        indexedProductRecordSchema,
      );
    }

    const products = storedProducts.map(toProduct);

    return products
      .filter(
        (product) =>
          (parsedQuery.vendorId === undefined ||
            product.vendorId === parsedQuery.vendorId) &&
          (parsedQuery.category === undefined ||
            product.category === parsedQuery.category) &&
          (parsedQuery.isAvailable === undefined ||
            product.isAvailable === parsedQuery.isAvailable) &&
          (parsedQuery.isSoldOut === undefined ||
            product.isSoldOut === parsedQuery.isSoldOut) &&
          (parsedQuery.isArchived === undefined ||
            product.isArchived === parsedQuery.isArchived),
      )
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          left.name.localeCompare(right.name, "en-SG"),
      );
  }

  public create(product: Product): Promise<void> {
    return addStoredRecord(
      this.database,
      tokenlyStoreNames.products,
      indexedProductRecordSchema,
      toIndexedProductRecord(product),
    );
  }

  public update(product: Product): Promise<void> {
    return replaceStoredRecord(
      this.database,
      tokenlyStoreNames.products,
      indexedProductRecordSchema,
      toIndexedProductRecord(product),
    );
  }
}
