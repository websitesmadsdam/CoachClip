/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation } from "../shared/annotations";

// Persisted project export state (IndexedDB). Uses "exported" where the server job says "completed";
// see shared/exportJob.ts for the server job status.
export type ExportStatus =
  | "not_exported"
  | "uploading"
  | "queued"
  | "processing"
  | "exported"
  | "failed"
  | "cancelled"
  | "expired";

export type CoachClipProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceVideo: {
    fileName: string;
    duration: number; // in seconds
    size: number; // in bytes
    width?: number;
    height?: number;
  };
  clip: {
    startTime: number;
    endTime: number;
  };
  annotations: Annotation[];
  category?: string;
  feedbackType?: "positive" | "development";
  collectionId?: string;
  exportStatus?: ExportStatus; // backward compatibility
  exportedVideoUrl?: string; // backward compatibility
  export?: {
    jobId?: string;
    status: ExportStatus;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    downloadUrl?: string;
    expiresAt?: string;
  };
};

export type {
  Annotation,
  TextAnnotation,
  CircleAnnotation,
  ArrowAnnotation,
  FreezeAnnotation,
} from "../shared/annotations";

export type Collection = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  projectIds: string[];
};

export const BRAND_COLORS = {
  dark: "#123B5D",       // Mørk blå
  clear: "#2D8CFF",      // Klar blå
  accent: "#FFB020",     // Gul/orange til markeringer
  success: "#2FA36B",    // Grøn til positive eksempler
  error: "#D64545",      // Rød til udviklingspunkter
  bg: "#F4F6F8",         // Lys grå
  panel: "#FFFFFF",      // Hvid
};
