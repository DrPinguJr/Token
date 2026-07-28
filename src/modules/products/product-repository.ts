import type { Product, ProductId, ProductQuery } from "./product";

export interface ProductRepository {
  getById(id: ProductId): Promise<Product | null>;
  list(query?: ProductQuery): Promise<readonly Product[]>;
  create(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
}
