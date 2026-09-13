import { describe, it, expect } from "vitest";
import {
  getAnnotationScale,
  wrapTextLines,
  layoutTextAnnotation,
  getArrowHead,
} from "./annotationGeometry";

const measure = (line: string, fontSize: number) => line.length * fontSize * 0.5;

describe("getAnnotationScale", () => {
  it("is 1 when the short side is 1080 in either orientation", () => {
    expect(getAnnotationScale(1920, 1080)).toBe(1);
    expect(getAnnotationScale(1080, 1920)).toBe(1);
  });

  it("scales with the short side", () => {
    expect(getAnnotationScale(640, 360)).toBeCloseTo(1 / 3);
  });
});

describe("wrapTextLines", () => {
  it("wraps greedily at 22 characters on spaces", () => {
    expect(wrapTextLines("Dette er en test af line wrap i CoachClip")).toEqual(["Dette er en test af", "line wrap i CoachClip"]);
  });

  it("keeps a word longer than the limit on its own line", () => {
    expect(wrapTextLines("kort ordmedmegetlangtindhold kort")).toEqual(["kort", "ordmedmegetlangtindhold", "kort"]);
  });

  it("returns no lines for empty text", () => {
    expect(wrapTextLines("")).toEqual([]);
  });
});

describe("layoutTextAnnotation", () => {
  it("sizes the font from the short side so portrait text is not huge", () => {
    expect(layoutTextAnnotation(1920, 1080, 0.5, 0.5, "normal", "Hej", measure).fontSize).toBeCloseTo(43.2);
    expect(layoutTextAnnotation(1080, 1920, 0.5, 0.5, "normal", "Hej", measure).fontSize).toBeCloseTo(43.2);
    expect(layoutTextAnnotation(1920, 1080, 0.5, 0.5, "banana", "Hej", measure).fontSize).toBeCloseTo(43.2);
  });

  it("uses the measured width of the widest line for the box", () => {
    const layout = layoutTextAnnotation(1000, 1000, 0.5, 0.25, "normal", "Dette er en test af line wrap", measure);
    // fontSize 40, padX 24, padY 18; widest line "Dette er en test af" = 19 chars × 20 px
    expect(layout.fontSize).toBe(40);
    expect(layout.lines).toEqual(["Dette er en test af", "line wrap"]);
    expect(layout.boxWidth).toBe(19 * 20 + 2 * 24);
    expect(layout.boxHeight).toBe(2 * 40 * 1.25 + 2 * 18);
    expect(layout.centerX).toBe(500);
    expect(layout.rectX).toBe(500 - layout.boxWidth / 2);
    expect(layout.rectY).toBe(250 - layout.boxHeight / 2);
    expect(layout.cornerRadius).toBeCloseTo(8.8);
    expect(layout.lineHeight).toBe(50);
    expect(layout.firstBaselineY).toBe(layout.rectY + 18 + 34);
  });
});

describe("getArrowHead", () => {
  it("places the tip 2.4 stroke widths past the line end with a 6 × 4.8 stroke triangle", () => {
    const head = getArrowHead(0, 0, 100, 0, 10)!;
    expect(head.tipX).toBeCloseTo(124);
    expect(head.tipY).toBeCloseTo(0);
    expect(head.leftX).toBeCloseTo(64);
    expect(head.rightX).toBeCloseTo(64);
    expect(Math.abs(head.leftY - head.rightY)).toBeCloseTo(48);
  });

  it("returns null for a zero-length arrow", () => {
    expect(getArrowHead(5, 5, 5, 5, 6)).toBeNull();
  });
});
