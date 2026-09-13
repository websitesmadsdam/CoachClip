/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, FreezeAnnotation } from "../../shared/annotations";

export const MIN_SEGMENT_SECONDS = 0.05;

export type VideoSegment = { type: "video"; start: number; end: number; frameCount: number; outputStartFrame: number };
export type FreezeSegment = { type: "freeze"; time: number; duration: number; frameCount: number; outputStartFrame: number };
export type ExportSegment = VideoSegment | FreezeSegment;
export type ExportPlan = { segments: ExportSegment[]; totalFrames: number; fps: number };

// A freeze inserts output time at f.time; playback resumes from f.time afterwards.
export function planSegments(
  clip: { startTime: number; endTime: number },
  annotations: Annotation[],
  fps: number
): ExportPlan {
  const { startTime: start, endTime: end } = clip;
  const freezes = annotations
    .filter((a): a is FreezeAnnotation => a.type === "freeze" && a.time >= start && a.time <= end && a.duration > 0)
    .sort((a, b) => a.time - b.time);

  const segments: ExportSegment[] = [];
  let outputFrame = 0;
  let currentPos = start;
  let lastFreezeTime = -Infinity;

  const pushVideo = (from: number, to: number) => {
    if (to - from <= MIN_SEGMENT_SECONDS) return;
    const frameCount = Math.round((to - from) * fps);
    if (frameCount === 0) return;
    segments.push({ type: "video", start: from, end: to, frameCount, outputStartFrame: outputFrame });
    outputFrame += frameCount;
  };

  for (const f of freezes) {
    if (f.time - lastFreezeTime < MIN_SEGMENT_SECONDS) continue;
    lastFreezeTime = f.time;
    pushVideo(currentPos, f.time);
    const frameCount = Math.round(f.duration * fps);
    segments.push({ type: "freeze", time: f.time, duration: f.duration, frameCount, outputStartFrame: outputFrame });
    outputFrame += frameCount;
    currentPos = f.time;
  }
  pushVideo(currentPos, end);

  if (segments.length === 0) throw new Error("EMPTY_PLAN");
  return { segments, totalFrames: outputFrame, fps };
}
