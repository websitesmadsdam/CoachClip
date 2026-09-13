/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, FreezeAnnotation } from "./annotations";

export const EXPORT_LIMITS = {
  minClipSeconds: 0.5,
  maxClipSeconds: 90,
  endToleranceSeconds: 0.5,
  maxAnnotations: 100,
  maxTexts: 50,
  maxShapes: 50,
  maxTextLength: 120,
  freezeDurations: [2, 3, 5],
  minFreezeGapSeconds: 0.05,
  maxTotalFreezeSeconds: 30,
} as const;

export type ExportValidationCode =
  | "INVALID_CLIP"
  | "INVALID_START_TIME"
  | "CLIP_TOO_SHORT"
  | "CLIP_TOO_LONG"
  | "INVALID_END_TIME"
  | "TOO_MANY_ANNOTATIONS"
  | "INVALID_FREEZE_DURATION"
  | "INVALID_FREEZE_TIME"
  | "DUPLICATE_FREEZE"
  | "TOO_MUCH_FREEZE"
  | "TEXT_TOO_LONG"
  | "INVALID_ANNOTATION_TIME"
  | "INVALID_COORDINATES"
  | "INVALID_RADIUS"
  | "INVALID_TYPE"
  | "TOO_MANY_TEXTS"
  | "TOO_MANY_SHAPES";

export type ExportValidationResult = { valid: boolean; code?: ExportValidationCode; message?: string };

export type ExportValidationInput = {
  clip: { startTime: number; endTime: number };
  sourceDuration: number;
  annotations: Annotation[];
};

const fail = (code: ExportValidationCode, message: string): ExportValidationResult => ({ valid: false, code, message });
const inUnitRange = (...values: number[]) => values.every((v) => typeof v === "number" && v >= 0 && v <= 1);

export function validateExport({ clip, sourceDuration, annotations }: ExportValidationInput): ExportValidationResult {
  if (typeof clip?.startTime !== "number" || typeof clip?.endTime !== "number") {
    return fail("INVALID_CLIP", "Ugyldige klipgrænser defineret.");
  }
  if (clip.startTime < 0) {
    return fail("INVALID_START_TIME", "Starttidspunktet kan ikke være negativt.");
  }
  const clipDuration = clip.endTime - clip.startTime;
  if (clipDuration < EXPORT_LIMITS.minClipSeconds) {
    return fail("CLIP_TOO_SHORT", "Det valgte klip skal være mindst 0,5 sekunder.");
  }
  if (clipDuration > EXPORT_LIMITS.maxClipSeconds) {
    return fail("CLIP_TOO_LONG", `Det valgte klip kan højst være ${EXPORT_LIMITS.maxClipSeconds} sekunder i denne version.`);
  }
  if (clip.endTime > sourceDuration + EXPORT_LIMITS.endToleranceSeconds) {
    return fail("INVALID_END_TIME", "Sluttidspunktet ligger ud over videoens faktiske varighed.");
  }
  if (!Array.isArray(annotations)) {
    return fail("INVALID_TYPE", "Annotationer skal leveres som et array.");
  }
  if (annotations.length > EXPORT_LIMITS.maxAnnotations) {
    return fail("TOO_MANY_ANNOTATIONS", "Der kan højst tilføjes 100 annotationer pr. klip.");
  }

  const freezes = annotations
    .filter((a): a is FreezeAnnotation => a?.type === "freeze")
    .sort((a, b) => a.time - b.time);
  let lastFreezeTime = -Infinity;
  let totalFreeze = 0;
  for (const f of freezes) {
    if (!(EXPORT_LIMITS.freezeDurations as readonly number[]).includes(f.duration)) {
      return fail("INVALID_FREEZE_DURATION", "Varighed af frysebillede skal være 2, 3 eller 5 sekunder.");
    }
    if (f.time < clip.startTime || f.time > clip.endTime) {
      return fail("INVALID_FREEZE_TIME", "Frysepunktet ligger uden for klippets tidsramme.");
    }
    if (Math.abs(f.time - lastFreezeTime) < EXPORT_LIMITS.minFreezeGapSeconds) {
      return fail("DUPLICATE_FREEZE", "To frysepunkter må ikke ligge på samme kildetidspunkt eller meget tæt på hinanden.");
    }
    lastFreezeTime = f.time;
    totalFreeze += f.duration;
  }
  if (totalFreeze > EXPORT_LIMITS.maxTotalFreezeSeconds) {
    return fail("TOO_MUCH_FREEZE", "Den samlede frysetid må højst være 30 sekunder.");
  }

  let texts = 0;
  let shapes = 0;
  const timeInvalid = (a: { startTime: number; endTime: number }) =>
    a.startTime < 0 || a.endTime < a.startTime || a.startTime > clip.endTime || a.endTime < clip.startTime;

  for (const a of annotations) {
    switch (a?.type) {
      case "text":
        texts++;
        if (typeof a.text !== "string" || a.text.length > EXPORT_LIMITS.maxTextLength) {
          return fail("TEXT_TOO_LONG", "En tekstannotation må højst indeholde 120 tegn.");
        }
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En tekstannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.x, a.y)) return fail("INVALID_COORDINATES", "Koordinater skal være mellem 0 og 1.");
        break;
      case "circle":
        shapes++;
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En cirkelannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.x, a.y)) return fail("INVALID_COORDINATES", "Koordinater skal være mellem 0 og 1.");
        if (!(a.radius > 0 && a.radius <= 1)) return fail("INVALID_RADIUS", "Radius skal være mellem 0 og 1.");
        break;
      case "arrow":
        shapes++;
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En pilannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.startX, a.startY, a.endX, a.endY)) {
          return fail("INVALID_COORDINATES", "Pilespidskoordinater skal være mellem 0 og 1.");
        }
        break;
      case "freeze":
        break;
      default:
        return fail("INVALID_TYPE", "Ugyldig annotationstype fundet.");
    }
  }
  if (texts > EXPORT_LIMITS.maxTexts) return fail("TOO_MANY_TEXTS", "Du kan højst tilføje 50 tekstannotationer.");
  if (shapes > EXPORT_LIMITS.maxShapes) {
    return fail("TOO_MANY_SHAPES", "Du kan højst tilføje 50 geometriske markeringer (cirkler/pile).");
  }
  return { valid: true };
}
