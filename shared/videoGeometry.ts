/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_LONG_SIDE = 1920;
export const MAX_SHORT_SIDE = 1080;

const REFERENCE_PIXELS = 1920 * 1080;
const REFERENCE_BITRATE = 8_000_000;
const MIN_BITRATE = 2_000_000;

const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

// Input is display dimensions (rotation already applied). Orientation is preserved.
export function computeOutputDimensions(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`Invalid video dimensions: ${width}x${height}`);
  }
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(width, height), MAX_SHORT_SIDE / Math.min(width, height));
  return { width: toEven(width * scale), height: toEven(height * scale) };
}

export function computeVideoBitrate(width: number, height: number): number {
  return Math.max(MIN_BITRATE, Math.round((REFERENCE_BITRATE * width * height) / REFERENCE_PIXELS));
}
