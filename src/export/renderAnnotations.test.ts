import { describe, it, expect } from "vitest";
import { renderAnnotations, isAnnotationActive, type AnnotationContext2D } from "./renderAnnotations";
import type { Annotation } from "../../shared/annotations";

type Call = { name: string; args: unknown[]; state: Record<string, unknown> };

// Records drawing calls together with the style state at the time of the call.
function createRecordingContext() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { font: "10px sans-serif", lineWidth: 1, strokeStyle: "", fillStyle: "", textAlign: "start", textBaseline: "alphabetic" };
  let dash: number[] = [];
  const snapshot = () => ({ ...state, dash: [...dash] });
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args, state: snapshot() }); };
  const ctx = {
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    fill: record("fill"),
    stroke: record("stroke"),
    roundRect: record("roundRect"),
    fillText: record("fillText"),
    setLineDash: (segments: number[]) => { dash = segments; },
    measureText: (line: string) => {
      const size = Number(/(\d+(\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
      return { width: line.length * size * 0.5 };
    },
  };
  const proxy = new Proxy(ctx, {
    get: (target, key: string) => (key in target ? target[key as keyof typeof target] : state[key]),
    set: (_target, key: string, value) => { state[key] = value; return true; },
  });
  return { ctx: proxy as unknown as AnnotationContext2D, calls };
}

const circle: Annotation = { id: "c", type: "circle", startTime: 2, endTime: 4, x: 0.25, y: 0.5, radius: 0.1, color: "red", thickness: "normal" };
const arrow: Annotation = { id: "a", type: "arrow", startTime: 2, endTime: 4, startX: 0, startY: 0.5, endX: 0.5, endY: 0.5, color: "yellow" };
const text: Annotation = { id: "t", type: "text", startTime: 2, endTime: 4, text: "Kom ind", x: 0.5, y: 0.5, size: "normal" };
const freeze: Annotation = { id: "f", type: "freeze", time: 3, duration: 2 };

describe("isAnnotationActive", () => {
  it("is inclusive at both ends and never true for freezes", () => {
    expect(isAnnotationActive(circle, 2)).toBe(true);
    expect(isAnnotationActive(circle, 4)).toBe(true);
    expect(isAnnotationActive(circle, 4.01)).toBe(false);
    expect(isAnnotationActive(freeze, 3)).toBe(false);
  });
});

describe("renderAnnotations", () => {
  it("draws nothing when no annotation is active", () => {
    const { ctx, calls } = createRecordingContext();
    renderAnnotations(ctx, 1920, 1080, [circle, arrow, text, freeze], 5);
    expect(calls.filter((c) => c.name !== "save" && c.name !== "restore")).toEqual([]);
  });

  it("draws a dashed normal circle with a scaled stroke", () => {
    const { ctx, calls } = createRecordingContext();
    renderAnnotations(ctx, 1920, 1080, [circle], 3);
    const arc = calls.find((c) => c.name === "arc")!;
    expect(arc.args.slice(0, 3)).toEqual([480, 540, 108]);
    const stroke = calls.find((c) => c.name === "stroke")!;
    expect(stroke.state.strokeStyle).toBe("#D64545");
    expect(stroke.state.lineWidth).toBe(4);
    expect(stroke.state.dash).toEqual([8, 8]);
    expect(calls.find((c) => c.name === "fill")!.state.fillStyle).toBe("rgba(255, 176, 32, 0.05)");
  });

  it("scales strokes down for smaller output", () => {
    const { ctx, calls } = createRecordingContext();
    renderAnnotations(ctx, 640, 360, [arrow], 3);
    const lineStroke = calls.find((c) => c.name === "stroke")!;
    expect(lineStroke.state.lineWidth).toBeCloseTo(2);
    expect(lineStroke.state.strokeStyle).toBe("#FFB020");
  });

  it("draws an arrow line and a filled head past the line end", () => {
    const { ctx, calls } = createRecordingContext();
    renderAnnotations(ctx, 1920, 1080, [arrow], 3);
    expect(calls.find((c) => c.name === "moveTo")!.args).toEqual([0, 540]);
    const headMove = calls.filter((c) => c.name === "moveTo")[1];
    expect(headMove.args[0]).toBeCloseTo(960 + 2.4 * 6);
    expect(calls.some((c) => c.name === "fill" && c.state.fillStyle === "#FFB020")).toBe(true);
  });

  it("draws a text box sized from the measured text and centered text lines", () => {
    const { ctx, calls } = createRecordingContext();
    renderAnnotations(ctx, 1920, 1080, [text], 3);
    const box = calls.find((c) => c.name === "roundRect")!;
    const fontSize = 43.2;
    const boxWidth = "Kom ind".length * fontSize * 0.5 + 2 * fontSize * 0.6;
    expect(box.args[2]).toBeCloseTo(boxWidth);
    expect(box.state.fillStyle).toBe("rgba(0, 0, 0, 0.82)");
    const line = calls.find((c) => c.name === "fillText")!;
    expect(line.args[0]).toBe("Kom ind");
    expect(line.args[1]).toBe(960);
    expect(line.state.fillStyle).toBe("#FFFFFF");
    expect(line.state.textAlign).toBe("center");
    expect(String(line.state.font)).toContain("bold");
  });
});
