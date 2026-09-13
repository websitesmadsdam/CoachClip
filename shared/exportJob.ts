/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// How often the client polls GET /api/exports/:jobId; server rate limits must allow this
export const EXPORT_POLL_INTERVAL_MS = 1200;

// Server-side lifecycle of a single export job, as returned by GET /api/exports/:jobId
export type ExportJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type ExportJobStage =
  | "waiting"
  | "validating"
  | "trimming"
  | "rendering_annotations"
  | "rendering_freezes"
  | "concatenating"
  | "encoding"
  | "finalizing"
  | "completed";

export type ExportJobOutput = {
  fileName: string;
  size: number;
  duration: number;
  downloadUrl: string;
  expiresAt: string;
};

// Public response shape; never includes server file paths
export type ExportJobResponse = {
  jobId: string;
  projectId: string;
  status: ExportJobStatus;
  stage?: ExportJobStage;
  progress?: number;
  errorCode?: string;
  userMessage?: string;
  createdAt: number;
  expiresAt?: number;
  output?: ExportJobOutput;
};
