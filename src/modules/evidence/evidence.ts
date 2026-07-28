import type { z } from "zod";

import type {
  evidenceCameraFacingModeSchema,
  evidenceCaptureModeSchema,
  evidenceKindSchema,
  evidenceMetadataSchema,
  evidenceMimeTypeSchema,
  evidenceQuerySchema,
  evidenceSchema,
  evidenceSourceSchema,
} from "./evidence-schema";

export type EvidenceId = string;
export type EvidenceCameraFacingMode = z.infer<
  typeof evidenceCameraFacingModeSchema
>;
export type EvidenceCaptureMode = z.infer<typeof evidenceCaptureModeSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceMetadata = Readonly<z.infer<typeof evidenceMetadataSchema>>;
export type EvidenceMimeType = z.infer<typeof evidenceMimeTypeSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type Evidence = Readonly<z.infer<typeof evidenceSchema>>;
export type EvidenceQuery = Readonly<z.infer<typeof evidenceQuerySchema>>;
