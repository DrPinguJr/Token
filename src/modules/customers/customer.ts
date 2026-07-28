import type { z } from "zod";

import type { customerQuerySchema, customerSchema } from "./customer-schema";

export type CustomerId = string;
export type Customer = Readonly<z.infer<typeof customerSchema>>;
export type CustomerQuery = Readonly<z.infer<typeof customerQuerySchema>>;
