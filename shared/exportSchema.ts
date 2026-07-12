/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Annotation } from "./annotations";

export type ExportRequestMetadata = {
  projectId: string;
  clip: {
    startTime: number;
    endTime: number;
  };
  sourceVideo: {
    fileName: string;
    duration: number;
    width?: number;
    height?: number;
  };
  annotations: Annotation[];
  output: {
    maxWidth: number;
    maxHeight: number;
    format: "mp4";
  };
};

export function sanitizeExportFileName(title: string): string {
  if (!title) return "coachclip_export.mp4";

  // Replace Danish characters specifically
  let cleaned = title
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/ø/g, "oe")
    .replace(/Ø/g, "Oe")
    .replace(/å/g, "aa")
    .replace(/Å/g, "Aa");

  // Keep only alphanumeric, spaces, dashes, and underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s-_]/g, "");

  // Normalize whitespace to single underscore
  cleaned = cleaned.trim().replace(/\s+/g, "_");

  // Avoid Windows reserved names
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(cleaned)) {
    cleaned = "_" + cleaned;
  }

  // Max 80 characters
  if (cleaned.length > 76) {
    cleaned = cleaned.substring(0, 76);
  }

  if (!cleaned) {
    cleaned = "export";
  }

  return `${cleaned}.mp4`;
}
