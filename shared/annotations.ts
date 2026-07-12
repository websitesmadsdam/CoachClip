/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
