import { describe, it, expect } from "vitest";
import { computeOutputDimensions, computeVideoBitrate } from "./videoGeometry";

describe("computeOutputDimensions", () => {
  it("scales 4K landscape to 1920x1080", () => {
    expect(computeOutputDimensions(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  it("keeps portrait video portrait at full HD", () => {
    expect(computeOutputDimensions(2160, 3840)).toEqual({ width: 1080, height: 1920 });
  });

  it("does not upscale small video", () => {
    expect(computeOutputDimensions(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it("rounds odd dimensions to even numbers", () => {
    expect(computeOutputDimensions(641, 361)).toEqual({ width: 642, height: 362 });
  });

  it("limits the short side to 1080 for 4:3 video", () => {
    expect(computeOutputDimensions(1920, 1440)).toEqual({ width: 1440, height: 1080 });
  });

  it("limits square video by the short side", () => {
    expect(computeOutputDimensions(4096, 4096)).toEqual({ width: 1080, height: 1080 });
  });

  it("rejects non-positive dimensions", () => {
    expect(() => computeOutputDimensions(0, 1080)).toThrow();
  });
});

describe("computeVideoBitrate", () => {
  it("uses 8 Mbps at 1920x1080", () => {
    expect(computeVideoBitrate(1920, 1080)).toBe(8_000_000);
  });

  it("scales with pixel count", () => {
    expect(computeVideoBitrate(1080, 1920)).toBe(8_000_000);
    expect(computeVideoBitrate(1440, 1080)).toBe(6_000_000);
  });

  it("never goes below 2 Mbps", () => {
    expect(computeVideoBitrate(640, 360)).toBe(2_000_000);
  });
});
