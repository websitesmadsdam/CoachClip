/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation } from "../shared/annotations";

// Persisted per project in IndexedDB. Projects saved by older versions can still contain server-era
// fields (exportedVideoUrl, export.jobId/downloadUrl/expiresAt, other statuses); they are ignored.
export type ExportStatus = "not_exported" | "exported";

export type ProjectExport = {
  status: "exported";
  fileName: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  exportedAt: string;
};

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
  exportStatus?: ExportStatus;
  export?: ProjectExport;
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
