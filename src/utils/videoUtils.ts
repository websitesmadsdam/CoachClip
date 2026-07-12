/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VideoBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Calculates the exact bounds of the visible video inside a contain-fit container.
 * This ensures annotations align perfectly with the player, regardless of aspect ratios and letterboxing/pillarboxing.
 */
export function getDisplayedVideoBounds(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): VideoBounds {
  if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }

  const containerRatio = containerWidth / containerHeight;
  const videoRatio = videoWidth / videoHeight;

  let width = containerWidth;
  let height = containerHeight;
  let left = 0;
  let top = 0;

  if (videoRatio > containerRatio) {
    // Video is wider than the container (letterbox top/bottom)
    height = containerWidth / videoRatio;
    top = (containerHeight - height) / 2;
  } else {
    // Video is taller than the container (pillarbox left/right)
    width = containerHeight * videoRatio;
    left = (containerWidth - width) / 2;
  }

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/**
 * Clamps a given time to fit within valid bounds.
 */
export function clampTime(time: number, maxDuration: number, minTime = 0): number {
  if (isNaN(time)) return minTime;
  return Math.max(minTime, Math.min(maxDuration, time));
}

/**
 * Formats precise time in MM:SS.C format.
 */
export function formatPreciseTime(sec: number): string {
  if (isNaN(sec) || sec === null || sec < 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ds = Math.floor((sec % 1) * 10);
  const mStr = m < 10 ? `0${m}` : `${m}`;
  const sStr = s < 10 ? `0${s}` : `${s}`;
  return `${mStr}:${sStr}.${ds}`;
}

/**
 * Calculates the expected output video duration considering original clip bounds and freeze-frames.
 */
export function getExpectedOutputDuration(clipDuration: number, freezeAnnotations: { duration: number }[]): number {
  const totalFreezeDuration = freezeAnnotations.reduce((acc, curr) => acc + curr.duration, 0);
  return clipDuration + totalFreezeDuration;
}
