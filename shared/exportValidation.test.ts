import { describe, it, expect } from "vitest";
import { validateExport, EXPORT_LIMITS } from "./exportValidation";
import type { Annotation } from "./annotations";

const clip = { startTime: 10, endTime: 40 };
const base = { clip, sourceDuration: 60, annotations: [] as Annotation[] };

const text = (overrides: Partial<Extract<Annotation, { type: "text" }>> = {}): Annotation => ({
  id: "t", type: "text", startTime: 12, endTime: 14, text: "Kom ind", x: 0.5, y: 0.5, size: "normal", ...overrides,
});
const circle = (overrides: Partial<Extract<Annotation, { type: "circle" }>> = {}): Annotation => ({
  id: "c", type: "circle", startTime: 12, endTime: 14, x: 0.5, y: 0.5, radius: 0.1, color: "yellow", thickness: "bold", ...overrides,
});
const arrow = (overrides: Partial<Extract<Annotation, { type: "arrow" }>> = {}): Annotation => ({
  id: "a", type: "arrow", startTime: 12, endTime: 14, startX: 0.1, startY: 0.1, endX: 0.5, endY: 0.5, color: "red", ...overrides,
});
const freeze = (time: number, duration: 2 | 3 | 5 = 3): Annotation => ({ id: `f${time}`, type: "freeze", time, duration });

describe("validateExport – clip", () => {
  it("accepts a valid clip without annotations", () => {
    expect(validateExport(base)).toEqual({ valid: true });
  });

  it("rejects a negative start", () => {
    expect(validateExport({ ...base, clip: { startTime: -1, endTime: 5 } }).code).toBe("INVALID_START_TIME");
  });

  it("rejects clips shorter than 0.5 s", () => {
    expect(validateExport({ ...base, clip: { startTime: 10, endTime: 10.4 } }).code).toBe("CLIP_TOO_SHORT");
  });

  it("rejects clips longer than 90 s", () => {
    const result = validateExport({ ...base, sourceDuration: 200, clip: { startTime: 0, endTime: 91 } });
    expect(result.code).toBe("CLIP_TOO_LONG");
    expect(result.message).toBe("Det valgte klip kan højst være 90 sekunder i denne version.");
  });

  it("allows the end 0.5 s past the source duration but not more", () => {
    expect(validateExport({ ...base, sourceDuration: 39.6 }).valid).toBe(true);
    expect(validateExport({ ...base, sourceDuration: 39.4 }).code).toBe("INVALID_END_TIME");
  });
});

describe("validateExport – freezes", () => {
  it("accepts non-overlapping freezes and freezes at the clip edges", () => {
    expect(validateExport({ ...base, annotations: [freeze(10, 2), freeze(25, 5), freeze(40, 5)] }).valid).toBe(true);
  });

  it("rejects invalid freeze durations", () => {
    const bad = { id: "f", type: "freeze", time: 15, duration: 4 } as unknown as Annotation;
    expect(validateExport({ ...base, annotations: [bad] }).code).toBe("INVALID_FREEZE_DURATION");
  });

  it("rejects freezes outside the clip", () => {
    expect(validateExport({ ...base, annotations: [freeze(5)] }).code).toBe("INVALID_FREEZE_TIME");
  });

  it("rejects freezes closer than 0.05 s", () => {
    expect(validateExport({ ...base, annotations: [freeze(20), freeze(20.03, 2)] }).code).toBe("DUPLICATE_FREEZE");
  });

  it("rejects more than 30 s of freezes in total", () => {
    const many = [12, 18, 24, 30, 35, 38, 39].map((t) => freeze(t, 5));
    expect(validateExport({ ...base, annotations: many }).code).toBe("TOO_MUCH_FREEZE");
  });
});

describe("validateExport – annotations", () => {
  it("rejects more than 100 annotations", () => {
    const annotations = Array.from({ length: EXPORT_LIMITS.maxAnnotations + 1 }, (_, i) => text({ id: `t${i}` }));
    expect(validateExport({ ...base, annotations }).code).toBe("TOO_MANY_ANNOTATIONS");
  });

  it("rejects text longer than 120 characters", () => {
    expect(validateExport({ ...base, annotations: [text({ text: "x".repeat(121) })] }).code).toBe("TEXT_TOO_LONG");
  });

  it("rejects annotation times outside the clip", () => {
    expect(validateExport({ ...base, annotations: [circle({ startTime: 41, endTime: 42 })] }).code).toBe("INVALID_ANNOTATION_TIME");
    expect(validateExport({ ...base, annotations: [arrow({ startTime: 14, endTime: 12 })] }).code).toBe("INVALID_ANNOTATION_TIME");
  });

  it("rejects coordinates outside 0–1", () => {
    expect(validateExport({ ...base, annotations: [text({ x: 1.2 })] }).code).toBe("INVALID_COORDINATES");
    expect(validateExport({ ...base, annotations: [arrow({ endY: -0.1 })] }).code).toBe("INVALID_COORDINATES");
  });

  it("rejects a radius outside (0, 1]", () => {
    expect(validateExport({ ...base, annotations: [circle({ radius: 0 })] }).code).toBe("INVALID_RADIUS");
  });

  it("rejects more than 50 texts or 50 shapes", () => {
    const texts = Array.from({ length: 51 }, (_, i) => text({ id: `t${i}` }));
    expect(validateExport({ ...base, annotations: texts }).code).toBe("TOO_MANY_TEXTS");
    const shapes = Array.from({ length: 51 }, (_, i) => (i % 2 ? circle({ id: `c${i}` }) : arrow({ id: `a${i}` })));
    expect(validateExport({ ...base, annotations: shapes }).code).toBe("TOO_MANY_SHAPES");
  });

  it("rejects unknown annotation types", () => {
    const unknown = { id: "u", type: "banana" } as unknown as Annotation;
    expect(validateExport({ ...base, annotations: [unknown] }).code).toBe("INVALID_TYPE");
  });

  it("rejects an annotation without a type with the server's message", () => {
    const untyped = { id: "u" } as unknown as Annotation;
    expect(validateExport({ ...base, annotations: [untyped] })).toEqual({
      valid: false,
      code: "INVALID_TYPE",
      message: "En annotation mangler en type.",
    });
  });
});
