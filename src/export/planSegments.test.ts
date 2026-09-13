import { describe, it, expect } from "vitest";
import { planSegments } from "./planSegments";
import type { Annotation } from "../../shared/annotations";

const freeze = (time: number, duration: 2 | 3 | 5): Annotation => ({ id: `f${time}`, type: "freeze", time, duration });
const clip = { startTime: 1, endTime: 5 };

describe("planSegments", () => {
  it("returns one video segment without freezes", () => {
    expect(planSegments(clip, [], 30)).toEqual({
      fps: 30,
      totalFrames: 120,
      segments: [{ type: "video", start: 1, end: 5, frameCount: 120, outputStartFrame: 0 }],
    });
  });

  it("inserts a freeze without consuming source time", () => {
    const plan = planSegments(clip, [freeze(3, 2)], 30);
    expect(plan.segments).toEqual([
      { type: "video", start: 1, end: 3, frameCount: 60, outputStartFrame: 0 },
      { type: "freeze", time: 3, duration: 2, frameCount: 60, outputStartFrame: 60 },
      { type: "video", start: 3, end: 5, frameCount: 60, outputStartFrame: 120 },
    ]);
    expect(plan.totalFrames).toBe(180);
  });

  it("supports freezes at the clip start and end", () => {
    const plan = planSegments(clip, [freeze(5, 3), freeze(1, 2)], 30);
    expect(plan.segments.map((s) => s.type)).toEqual(["freeze", "video", "freeze"]);
    expect(plan.segments[0]).toMatchObject({ time: 1, outputStartFrame: 0, frameCount: 60 });
    expect(plan.segments[1]).toMatchObject({ start: 1, end: 5, outputStartFrame: 60 });
    expect(plan.segments[2]).toMatchObject({ time: 5, outputStartFrame: 180, frameCount: 90 });
    expect(plan.totalFrames).toBe(270);
  });

  it("drops video stretches of 0.05 s or less", () => {
    const plan = planSegments(clip, [freeze(1.03, 2)], 30);
    expect(plan.segments.map((s) => s.type)).toEqual(["freeze", "video"]);
    expect(plan.segments[1]).toMatchObject({ start: 1.03, end: 5 });
  });

  it("ignores freezes outside the clip, non-freeze annotations and freezes closer than 0.05 s", () => {
    const annotations: Annotation[] = [
      freeze(0.5, 2),
      freeze(6, 2),
      freeze(3, 2),
      freeze(3.02, 3),
      { id: "t", type: "text", startTime: 1, endTime: 5, text: "x", x: 0.5, y: 0.5, size: "normal" },
    ];
    const plan = planSegments(clip, annotations, 30);
    expect(plan.segments.filter((s) => s.type === "freeze")).toHaveLength(1);
    expect(plan.totalFrames).toBe(180);
  });

  it("quantizes durations to whole frames", () => {
    const plan = planSegments({ startTime: 0, endTime: 1.01 }, [], 30);
    expect(plan.segments[0]).toMatchObject({ frameCount: 30 });
  });

  it("throws when nothing can be rendered", () => {
    expect(() => planSegments({ startTime: 2, endTime: 2.01 }, [], 30)).toThrow("EMPTY_PLAN");
  });
});
