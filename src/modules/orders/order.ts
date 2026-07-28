import type { z } from "zod";

import type {
  orderItemSchema,
  orderQuerySchema,
  orderSchema,
  orderStatusSchema,
} from "./order-schema";

export type OrderId = string;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderItem = Readonly<z.infer<typeof orderItemSchema>>;
export type Order = Readonly<z.infer<typeof orderSchema>>;
export type OrderQuery = Readonly<z.infer<typeof orderQuerySchema>>;
