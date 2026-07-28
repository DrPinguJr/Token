import type { z } from "zod";

import type {
  vendorOperatingStatusSchema,
  vendorQuerySchema,
  vendorSchema,
} from "./vendor-schema";

export type VendorId = string;
export type VendorOperatingStatus = z.infer<typeof vendorOperatingStatusSchema>;
export type Vendor = Readonly<z.infer<typeof vendorSchema>>;
export type VendorQuery = Readonly<z.infer<typeof vendorQuerySchema>>;
