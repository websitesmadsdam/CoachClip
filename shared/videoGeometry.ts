/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function computeOutputDimensions(
  width: number,
  height: number,
  maxWidth = 1920,
  maxHeight = 1080
): { width: number; height: number } {
  let outW = width;
  let outH = height;

  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    outW = Math.round((width * scale) / 2) * 2;
    outH = Math.round((height * scale) / 2) * 2;
  } else {
    outW = Math.round(width / 2) * 2;
    outH = Math.round(height / 2) * 2;
  }

  return { width: outW, height: outH };
}
