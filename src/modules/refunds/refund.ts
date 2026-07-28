import type { z } from "zod";

import type { refundQuerySchema, refundSchema } from "./refund-schema";

export type RefundId = string;
export type Refund = Readonly<z.infer<typeof refundSchema>>;
export type RefundQuery = Readonly<z.infer<typeof refundQuerySchema>>;
