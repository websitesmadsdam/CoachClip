/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Annotation } from "../../../src/types";

export type ExportStatus =
  | "not_exported"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type ExportStage =
  | "validating"
  | "trimming"
  | "rendering_annotations"
  | "rendering_freezes"
  | "encoding"
  | "finalizing";

export type ExportJob = {
  jobId: string;
  projectId: string;
  status: ExportStatus;
  stage?: ExportStage;
  progress?: number;
  errorCode?: string;
  userMessage?: string;
  inputFilePath?: string;
  outputFilePath?: string;
  createdAt: number;
  expiresAt?: number;
  output?: {
    fileName: string;
    size: number;
    duration: number;
    downloadUrl: string;
    expiresAt: string;
  };
};

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
