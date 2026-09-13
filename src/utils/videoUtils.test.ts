import { describe, it, expect } from "vitest";
import { getDisplayedVideoBounds } from "./videoUtils";

describe("getDisplayedVideoBounds", () => {
  it("pillarboxes a portrait video inside a wider container", () => {
    // width = 450 * (1080/1920)
    expect(getDisplayedVideoBounds(800, 450, 1080, 1920)).toEqual({
      left: 273.4375,
      top: 0,
      width: 253.125,
      height: 450,
    });
  });

  it("letterboxes a landscape video inside a square container", () => {
    expect(getDisplayedVideoBounds(400, 400, 1920, 1080)).toEqual({
      left: 0,
      top: 87.5,
      width: 400,
      height: 225,
    });
  });

  it("fills the container when the video size is not known yet", () => {
    expect(getDisplayedVideoBounds(800, 450, 0, 0)).toEqual({
      left: 0,
      top: 0,
      width: 800,
      height: 450,
    });
  });
});
