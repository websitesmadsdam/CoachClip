/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const ARROW_GEOMETRY = {
  strokeWidth: 6,
  minLength: 10,
  colors: {
    yellow: "#FFB020",
    red: "#D64545",
    white: "#FFFFFF",
  },
};

export const TEXT_GEOMETRY = {
  fontSizes: {
    small: 0.03, // fraction of height
    normal: 0.04, // fraction of height
    large: 0.055, // fraction of height
  },
  paddingXFactor: 0.6,
  paddingYFactor: 0.45,
  lineHeightFactor: 1.25,
  maxCharsPerLine: 22,
  bgColor: "rgba(0, 0, 0, 0.82)",
};

export const CIRCLE_GEOMETRY = {
  colors: {
    yellow: "#FFB020",
    red: "#D64545",
    white: "#FFFFFF",
  },
  bgOpacity: 0.08,
};

export function getCircleGeometry(videoWidth: number, videoHeight: number, radius: number) {
  const base = Math.min(videoWidth, videoHeight);
  const radiusPx = radius * base;
  return {
    rx: radiusPx,
    ry: radiusPx,
    radiusPx,
  };
}

export function getArrowGeometry(
  videoWidth: number,
  videoHeight: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const x1 = startX * videoWidth;
  const y1 = startY * videoHeight;
  const x2 = endX * videoWidth;
  const y2 = endY * videoHeight;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  return {
    x1,
    y1,
    x2,
    y2,
    length,
    strokeWidth: ARROW_GEOMETRY.strokeWidth,
  };
}

export function getTextGeometry(
  videoWidth: number,
  videoHeight: number,
  x: number,
  y: number,
  size: "small" | "normal" | "large" | string,
  text: string
) {
  const sizeKey = size in TEXT_GEOMETRY.fontSizes ? (size as "small" | "normal" | "large") : "normal";
  const fontSize = TEXT_GEOMETRY.fontSizes[sizeKey] * videoHeight;
  const charWidth = fontSize * 0.52;
  const paddingX = fontSize * TEXT_GEOMETRY.paddingXFactor;
  const paddingY = fontSize * TEXT_GEOMETRY.paddingYFactor;

  // Split lines
  const lines = wrapTextLines(text);

  const maxLineLength = Math.max(...lines.map((l) => l.length), 0);
  const boxWidth = maxLineLength * charWidth + paddingX * 2;
  const boxHeight = lines.length * fontSize * TEXT_GEOMETRY.lineHeightFactor + paddingY * 2;

  const rectX = x * videoWidth - boxWidth / 2;
  const rectY = y * videoHeight - boxHeight / 2;

  return {
    rectX,
    rectY,
    boxWidth,
    boxHeight,
    fontSize,
    paddingX,
    paddingY,
    lines,
  };
}

// ---- Canvas rendering geometry (shared by browser preview and browser export) ----

export const ANNOTATION_COLORS = {
  yellow: "#FFB020",
  red: "#D64545",
  white: "#FFFFFF",
} as const;

// Pixel values are for an output whose short side is 1080 px; multiply by getAnnotationScale().
export const ANNOTATION_STYLE = {
  referenceShortSide: 1080,
  circleStrokeBold: 8,
  circleStrokeNormal: 4,
  circleDash: 8,
  circleFill: "rgba(255, 176, 32, 0.05)",
  arrowStroke: 6,
  arrowHeadLengthFactor: 6,
  arrowHeadWidthFactor: 4.8,
  arrowTipOvershootFactor: 2.4,
  textColor: "#FFFFFF",
  textBackground: TEXT_GEOMETRY.bgColor,
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: "bold",
  cornerRadiusFactor: 0.22,
  firstBaselineFactor: 0.85,
} as const;

export function getAnnotationScale(width: number, height: number): number {
  return Math.min(width, height) / ANNOTATION_STYLE.referenceShortSide;
}

export function wrapTextLines(text: string, maxChars: number = TEXT_GEOMETRY.maxCharsPerLine): string[] {
  const lines: string[] = [];
  let currentLine = "";
  for (const word of text.split(" ")) {
    if ((currentLine + " " + word).trim().length <= maxChars) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export type MeasureTextWidth = (line: string, fontSize: number) => number;

export type TextLayout = {
  centerX: number;
  rectX: number;
  rectY: number;
  boxWidth: number;
  boxHeight: number;
  cornerRadius: number;
  fontSize: number;
  lineHeight: number;
  firstBaselineY: number;
  lines: string[];
};

export function layoutTextAnnotation(
  width: number,
  height: number,
  x: number,
  y: number,
  size: string,
  text: string,
  measure: MeasureTextWidth
): TextLayout {
  const sizeKey = size in TEXT_GEOMETRY.fontSizes ? (size as keyof typeof TEXT_GEOMETRY.fontSizes) : "normal";
  const fontSize = TEXT_GEOMETRY.fontSizes[sizeKey] * Math.min(width, height);
  const paddingX = fontSize * TEXT_GEOMETRY.paddingXFactor;
  const paddingY = fontSize * TEXT_GEOMETRY.paddingYFactor;
  const lineHeight = fontSize * TEXT_GEOMETRY.lineHeightFactor;
  const lines = wrapTextLines(text);
  const widest = lines.reduce((max, line) => Math.max(max, measure(line, fontSize)), 0);
  const boxWidth = widest + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const centerX = x * width;
  const rectX = centerX - boxWidth / 2;
  const rectY = y * height - boxHeight / 2;
  return {
    centerX,
    rectX,
    rectY,
    boxWidth,
    boxHeight,
    cornerRadius: fontSize * ANNOTATION_STYLE.cornerRadiusFactor,
    fontSize,
    lineHeight,
    firstBaselineY: rectY + paddingY + fontSize * ANNOTATION_STYLE.firstBaselineFactor,
    lines,
  };
}

export type ArrowHead = { tipX: number; tipY: number; leftX: number; leftY: number; rightX: number; rightY: number };

// Same shape as the former SVG marker: 6 × 4.8 stroke widths, tip 2.4 stroke widths past the line end.
export function getArrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): ArrowHead | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  const tipX = x2 + ux * ANNOTATION_STYLE.arrowTipOvershootFactor * strokeWidth;
  const tipY = y2 + uy * ANNOTATION_STYLE.arrowTipOvershootFactor * strokeWidth;
  const baseX = tipX - ux * ANNOTATION_STYLE.arrowHeadLengthFactor * strokeWidth;
  const baseY = tipY - uy * ANNOTATION_STYLE.arrowHeadLengthFactor * strokeWidth;
  const half = (ANNOTATION_STYLE.arrowHeadWidthFactor * strokeWidth) / 2;
  return {
    tipX,
    tipY,
    leftX: baseX - uy * half,
    leftY: baseY + ux * half,
    rightX: baseX + uy * half,
    rightY: baseY - ux * half,
  };
}
