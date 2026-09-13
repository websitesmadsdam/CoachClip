/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, ArrowAnnotation, CircleAnnotation, TextAnnotation } from "../../shared/annotations";
import {
  ANNOTATION_COLORS,
  ANNOTATION_STYLE,
  getAnnotationScale,
  getArrowGeometry,
  getArrowHead,
  getCircleGeometry,
  layoutTextAnnotation,
} from "../../shared/annotationGeometry";

export type AnnotationContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function isAnnotationActive(annotation: Annotation, time: number): boolean {
  return annotation.type !== "freeze" && annotation.startTime <= time && time <= annotation.endTime;
}

const fontFor = (fontSize: number) => `${ANNOTATION_STYLE.fontWeight} ${fontSize}px ${ANNOTATION_STYLE.fontFamily}`;

function drawCircle(ctx: AnnotationContext2D, width: number, height: number, a: CircleAnnotation, scale: number) {
  const { radiusPx } = getCircleGeometry(width, height, a.radius);
  const bold = a.thickness === "bold";
  ctx.beginPath();
  ctx.arc(a.x * width, a.y * height, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = ANNOTATION_STYLE.circleFill;
  ctx.fill();
  ctx.lineWidth = (bold ? ANNOTATION_STYLE.circleStrokeBold : ANNOTATION_STYLE.circleStrokeNormal) * scale;
  ctx.strokeStyle = ANNOTATION_COLORS[a.color] ?? ANNOTATION_COLORS.white;
  ctx.setLineDash(bold ? [] : [ANNOTATION_STYLE.circleDash * scale, ANNOTATION_STYLE.circleDash * scale]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawArrow(ctx: AnnotationContext2D, width: number, height: number, a: ArrowAnnotation, scale: number) {
  const { x1, y1, x2, y2 } = getArrowGeometry(width, height, a.startX, a.startY, a.endX, a.endY);
  const strokeWidth = ANNOTATION_STYLE.arrowStroke * scale;
  const color = ANNOTATION_COLORS[a.color] ?? ANNOTATION_COLORS.white;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
  const head = getArrowHead(x1, y1, x2, y2, strokeWidth);
  if (!head) return;
  ctx.beginPath();
  ctx.moveTo(head.tipX, head.tipY);
  ctx.lineTo(head.leftX, head.leftY);
  ctx.lineTo(head.rightX, head.rightY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawText(ctx: AnnotationContext2D, width: number, height: number, a: TextAnnotation) {
  const measure = (line: string, fontSize: number) => {
    ctx.font = fontFor(fontSize);
    return ctx.measureText(line).width;
  };
  const layout = layoutTextAnnotation(width, height, a.x, a.y, a.size, a.text, measure);
  if (layout.lines.length === 0) return;
  ctx.beginPath();
  ctx.fillStyle = ANNOTATION_STYLE.textBackground;
  ctx.roundRect(layout.rectX, layout.rectY, layout.boxWidth, layout.boxHeight, layout.cornerRadius);
  ctx.fill();
  ctx.font = fontFor(layout.fontSize);
  ctx.fillStyle = ANNOTATION_STYLE.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, layout.centerX, layout.firstBaselineY + index * layout.lineHeight);
  });
}

// Draws every non-freeze annotation active at `time` (source seconds) onto an output of width × height.
export function renderAnnotations(
  ctx: AnnotationContext2D,
  width: number,
  height: number,
  annotations: Annotation[],
  time: number
): void {
  const scale = getAnnotationScale(width, height);
  for (const annotation of annotations) {
    if (!isAnnotationActive(annotation, time)) continue;
    ctx.save();
    if (annotation.type === "circle") drawCircle(ctx, width, height, annotation, scale);
    else if (annotation.type === "arrow") drawArrow(ctx, width, height, annotation, scale);
    else if (annotation.type === "text") drawText(ctx, width, height, annotation);
    ctx.restore();
  }
}
