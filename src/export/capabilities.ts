/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { canEncodeAudio, canEncodeVideo } from "mediabunny";

export type CapabilityProbe = {
  hasWebCodecs: boolean;
  hasOffscreenCanvas: boolean;
  hasOpfsWritable: boolean;
  canShareFiles: boolean;
  canEncodeH264: (width: number, height: number) => Promise<boolean>;
  canEncodeAac: () => Promise<boolean>;
};

export type ExportCapabilities = {
  supported: boolean;
  reason?: "NO_WEBCODECS" | "NO_OFFSCREEN_CANVAS" | "NO_H264_ENCODER";
  nativeAac: boolean;
  opfs: boolean;
  shareFiles: boolean;
};

export function browserCapabilityProbe(): CapabilityProbe {
  const g = globalThis as typeof globalThis & { FileSystemFileHandle?: { prototype: object } };
  return {
    hasWebCodecs: typeof g.VideoEncoder === "function" && typeof g.VideoDecoder === "function",
    hasOffscreenCanvas: typeof g.OffscreenCanvas === "function",
    hasOpfsWritable: !!g.FileSystemFileHandle && "createWritable" in g.FileSystemFileHandle.prototype,
    canShareFiles: typeof navigator !== "undefined" && typeof navigator.canShare === "function",
    canEncodeH264: (width, height) => canEncodeVideo("avc", { width, height }),
    canEncodeAac: () => canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 }),
  };
}

const safely = async (check: () => Promise<boolean>) => {
  try {
    return await check();
  } catch {
    return false;
  }
};

export async function detectExportCapabilities(
  probe: CapabilityProbe = browserCapabilityProbe(),
  size: { width: number; height: number } = { width: 1920, height: 1080 }
): Promise<ExportCapabilities> {
  const extras = { nativeAac: false, opfs: probe.hasOpfsWritable, shareFiles: probe.canShareFiles };
  if (!probe.hasWebCodecs) return { supported: false, reason: "NO_WEBCODECS", ...extras };
  if (!probe.hasOffscreenCanvas) return { supported: false, reason: "NO_OFFSCREEN_CANVAS", ...extras };
  if (!(await safely(() => probe.canEncodeH264(size.width, size.height)))) {
    return { supported: false, reason: "NO_H264_ENCODER", ...extras };
  }
  return { supported: true, ...extras, nativeAac: await safely(probe.canEncodeAac) };
}
