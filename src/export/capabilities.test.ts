import { describe, it, expect } from "vitest";
import { detectExportCapabilities, type CapabilityProbe } from "./capabilities";

const probe = (overrides: Partial<CapabilityProbe> = {}): CapabilityProbe => ({
  hasWebCodecs: true,
  hasOffscreenCanvas: true,
  hasOpfsWritable: true,
  canShareFiles: true,
  canEncodeH264: async () => true,
  canEncodeAac: async () => true,
  ...overrides,
});

describe("detectExportCapabilities", () => {
  it("is supported when WebCodecs, OffscreenCanvas and H.264 encoding exist", async () => {
    expect(await detectExportCapabilities(probe())).toEqual({ supported: true, nativeAac: true, opfs: true, shareFiles: true });
  });

  it("is unsupported without WebCodecs", async () => {
    const result = await detectExportCapabilities(probe({ hasWebCodecs: false }));
    expect(result).toMatchObject({ supported: false, reason: "NO_WEBCODECS" });
  });

  it("is unsupported without OffscreenCanvas", async () => {
    const result = await detectExportCapabilities(probe({ hasOffscreenCanvas: false }));
    expect(result).toMatchObject({ supported: false, reason: "NO_OFFSCREEN_CANVAS" });
  });

  it("is unsupported when H.264 cannot be encoded at the requested size", async () => {
    const sizes: Array<[number, number]> = [];
    const result = await detectExportCapabilities(
      probe({ canEncodeH264: async (w, h) => { sizes.push([w, h]); return false; } }),
      { width: 1080, height: 1920 }
    );
    expect(result).toMatchObject({ supported: false, reason: "NO_H264_ENCODER" });
    expect(sizes).toEqual([[1080, 1920]]);
  });

  it("stays supported without native AAC, OPFS or file sharing", async () => {
    const result = await detectExportCapabilities(
      probe({ canEncodeAac: async () => false, hasOpfsWritable: false, canShareFiles: false })
    );
    expect(result).toEqual({ supported: true, nativeAac: false, opfs: false, shareFiles: false });
  });

  it("treats a throwing encoder probe as unsupported", async () => {
    const result = await detectExportCapabilities(probe({ canEncodeH264: async () => { throw new Error("nope"); } }));
    expect(result).toMatchObject({ supported: false, reason: "NO_H264_ENCODER" });
  });
});
