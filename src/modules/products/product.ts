import type { z } from "zod";

import type { productQuerySchema, productSchema } from "./product-schema";

export type ProductId = string;
export type Product = Readonly<z.infer<typeof productSchema>>;
export type ProductQuery = Readonly<z.infer<typeof productQuerySchema>>;
