import { describe, it, expect } from "vitest";
import { isProjectExported, hasMatchingSource } from "./projectStatus";
import type { CoachClipProject } from "../types";

const base = {
  sourceVideo: { fileName: "kamp.mov", duration: 60, size: 3 },
} as Pick<CoachClipProject, "sourceVideo">;

describe("isProjectExported", () => {
  it("is true for the current export record", () => {
    const project = {
      export: { status: "exported", fileName: "a.mp4", fileSize: 1, duration: 1, width: 640, height: 360, exportedAt: "2026-09-13T10:00:00.000Z" },
    } as Pick<CoachClipProject, "exportStatus" | "export">;
    expect(isProjectExported(project)).toBe(true);
  });

  it("is true for the legacy exportStatus field", () => {
    expect(isProjectExported({ exportStatus: "exported" })).toBe(true);
  });

  it("is false for legacy server states such as expired", () => {
    const legacy = { export: { status: "expired" } } as unknown as Pick<CoachClipProject, "exportStatus" | "export">;
    expect(isProjectExported(legacy)).toBe(false);
  });

  it("is false when nothing was exported", () => {
    expect(isProjectExported({ exportStatus: "not_exported" })).toBe(false);
    expect(isProjectExported({})).toBe(false);
  });
});

describe("hasMatchingSource", () => {
  it("matches on file name and size", () => {
    expect(hasMatchingSource(new File(["abc"], "kamp.mov"), base)).toBe(true);
  });

  it("does not match another file or no file", () => {
    expect(hasMatchingSource(new File(["abcd"], "kamp.mov"), base)).toBe(false);
    expect(hasMatchingSource(new File(["abc"], "andet.mov"), base)).toBe(false);
    expect(hasMatchingSource(null, base)).toBe(false);
  });
});
