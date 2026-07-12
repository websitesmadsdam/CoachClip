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
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= TEXT_GEOMETRY.maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

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
