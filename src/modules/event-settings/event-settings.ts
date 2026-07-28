import type { z } from "zod";

import type {
  eventDateRangeSchema,
  eventSettingsSchema,
} from "./event-settings-schema";

export type EventSettingsId = string;
export type EventDateRange = Readonly<z.infer<typeof eventDateRangeSchema>>;
export type EventSettings = Readonly<z.infer<typeof eventSettingsSchema>>;
