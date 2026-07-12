/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export type Annotation =
  | TextAnnotation
  | CircleAnnotation
  | ArrowAnnotation
  | FreezeAnnotation;

export type TextAnnotation = {
  id: string;
  type: "text";
  startTime: number;
  endTime: number;
  text: string;
  x: number; // relative coordinate 0 to 1
  y: number; // relative coordinate 0 to 1
  size: "small" | "normal" | "large";
  positionPreset?: "top" | "center" | "bottom";
};

export type CircleAnnotation = {
  id: string;
  type: "circle";
  startTime: number;
  endTime: number;
  x: number; // relative center X
  y: number; // relative center Y
  radius: number; // relative radius (e.g. 0.05 to 0.25)
  color: "yellow" | "red" | "white";
  thickness: "normal" | "bold";
};

export type ArrowAnnotation = {
  id: string;
  type: "arrow";
  startTime: number;
  endTime: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: "yellow" | "red" | "white";
};

export type FreezeAnnotation = {
  id: string;
  type: "freeze";
  time: number; // exact point in clip
  duration: 2 | 3 | 5;
};

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
