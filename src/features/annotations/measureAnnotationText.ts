/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotationFont } from "../../export/renderAnnotations";

let context: CanvasRenderingContext2D | null = null;

// Measures text exactly like the export canvas so DOM hit areas line up with the drawn text boxes.
export function measureAnnotationText(line: string, fontSize: number): number {
  if (!context) context = document.createElement("canvas").getContext("2d");
  if (!context) return line.length * fontSize * 0.52;
  context.font = annotationFont(fontSize);
  return context.measureText(line).width;
}
