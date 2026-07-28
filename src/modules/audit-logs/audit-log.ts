import type { z } from "zod";

import type {
  auditEventTypeSchema,
  auditLogQuerySchema,
  auditLogSchema,
  auditTargetTypeSchema,
} from "./audit-log-schema";

export type AuditLogId = string;
export type AuditEventType = z.infer<typeof auditEventTypeSchema>;
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>;
export type AuditLog = Readonly<z.infer<typeof auditLogSchema>>;
export type AuditLogQuery = Readonly<z.infer<typeof auditLogQuerySchema>>;
