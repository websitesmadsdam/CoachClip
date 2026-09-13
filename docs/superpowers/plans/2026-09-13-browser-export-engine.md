# Browser Export Engine Implementation Plan (PR A + PR B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge PR #4, then add a self-contained, fully tested in-browser MP4 export engine (`src/export/`) that PR C will wire into the UI.

**Architecture:** Pure logic (output dimensions, validation, segment planning, text layout, error mapping) lives in `shared/` and `src/export/` and is unit tested in Node with vitest. Browser-only modules (storage, audio decoding, the `exportClip` orchestrator, delivery) use Mediabunny 1.56.2 on top of WebCodecs and are tested in real Google Chrome through a dev-only harness page driven by a separate Playwright config. The existing server and UI are not touched in this plan.

**Tech Stack:** TypeScript 5.8, Vite 6, vitest 4, Playwright 1.61 (`channel: "chrome"`), Mediabunny 1.56.2, @mediabunny/aac-encoder 1.56.2, FFmpeg (only to generate committed test fixtures once).

**Spec:** `docs/superpowers/specs/2026-09-13-browser-export-design.md`

**Scope note:** This plan covers spec section 10 items 1 (PR A) and 2 (PR B). PR C (UI switch + server removal) and D (deploy/domain/cleanup) get their own plans after PR B is merged, because they build on the interfaces this plan produces.

## Global Constraints

- Mediabunny versions pinned exactly: `mediabunny@1.56.2`, `@mediabunny/aac-encoder@1.56.2`.
- Export output: H.264 (`codec: "avc"`) + AAC (`codec: "aac"`), constant 30 fps, longest side ≤ 1920, shortest side ≤ 1080, even dimensions.
- Video bitrate: `max(2_000_000, round(8_000_000 × w × h / (1920 × 1080)))`. Keyframe interval 2 s. Audio bitrate 128 000.
- All times in the data model are absolute source-video seconds. Coordinates are relative 0–1.
- Types come from `shared/`. Nothing under `shared/` or `server/` imports from `src/`.
- User-facing text is Danish, written for a coach. Code, comments, commits are English.
- `tsconfig.json` has no `strict`: do not rely on narrowing unions by a boolean discriminant (`{ ok: true } | { ok: false }`); use plain optional fields instead. String-literal discriminants (`type: "video"`) are fine.
- OPFS files created by the engine are named `coachclip-export-<uuid>.mp4` and must be removed on cancel/failure.
- Every commit ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Windows dev: FFmpeg is at `%LOCALAPPDATA%\Microsoft\WinGet\Links` (on PATH in PowerShell, not in Git Bash). Google Chrome is installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/videoGeometry.ts` (modify) | `computeOutputDimensions`, `computeVideoBitrate` |
| `shared/videoGeometry.test.ts` (create) | unit tests |
| `shared/exportValidation.ts` (create) | `validateExport` + `EXPORT_LIMITS`, rules moved from `server/src/routes/exportRoutes.ts` |
| `shared/exportValidation.test.ts` (create) | unit tests |
| `shared/annotationGeometry.ts` (modify) | add `getAnnotationScale`, `wrapTextLines`, `layoutTextAnnotation`, `getArrowHead`, `ANNOTATION_STYLE`, `ANNOTATION_COLORS`; old functions stay for the server until PR C |
| `shared/annotationGeometry.test.ts` (create) | unit tests for the new functions |
| `src/export/planSegments.ts` (create) | clip + freezes → frame-quantized segment timeline |
| `src/export/planSegments.test.ts` (create) | unit tests |
| `src/export/renderAnnotations.ts` (create) | draw active annotations on a 2D canvas context |
| `src/export/renderAnnotations.test.ts` (create) | unit tests with a recording fake context |
| `src/export/exportErrors.ts` (create) | `ExportError`, codes, Danish messages, `toExportError` |
| `src/export/exportErrors.test.ts` (create) | unit tests |
| `src/export/capabilities.ts` (create) | `detectExportCapabilities` with injectable probe |
| `src/export/capabilities.test.ts` (create) | unit tests |
| `src/export/exportStorage.ts` (create) | OPFS / in-memory output sink, cleanup |
| `src/export/decodeClipAudio.ts` (create) | WebCodecs audio decode with Web Audio fallback, append helpers |
| `src/export/exportClip.ts` (create) | orchestrator |
| `src/export/deliverClip.ts` (create) | share sheet or download |
| `scripts/generateExportFixtures.ts` (create) | one-off FFmpeg generation of test media |
| `e2e/fixtures/media/*.mp4` (create, committed) | test media |
| `e2e/harness/export.html`, `e2e/harness/exportHarness.ts` (create) | dev-only page exposing the engine to Playwright |
| `e2e/engine/exportEngine.spec.ts` (create) | browser tests |
| `playwright.engine.config.ts` (create) | Chrome + Vite dev server for the engine tests |
| `playwright.config.ts` (modify) | ignore `e2e/engine/**` |
| `package.json` (modify) | deps, `test:engine`, `verify:engine`, `verify` chain |
| `.github/workflows/verify.yml` (modify) | install Chrome |

---

### Task 1: Merge PR #4 and create the feature branch

**Files:** none (git only)

**Interfaces:**
- Produces: `main` containing `shared/annotations.ts` as the only annotation type source, `src/types.ts` re-exporting it, and `shared/exportJob.ts`. Branch `feat/browser-export-engine` containing the spec and this plan.

- [ ] **Step 1: Confirm #4 is green and mergeable**

Run: `gh pr view 4 --json state,mergeStateStatus --jq '"\(.state) \(.mergeStateStatus)"'`
Expected: `OPEN CLEAN`

- [ ] **Step 2: Merge with a merge commit (not squash) and delete the branch**

Run: `gh pr merge 4 --merge --delete-branch`
Expected: exit 0; `gh pr view 4 --json state --jq .state` prints `MERGED`.

- [ ] **Step 3: Bring the docs branch up to date and branch off**

```bash
cd /e/Projekter/CoachClip
git fetch --prune origin
git switch docs/browser-export-design
git merge --no-edit origin/main
git switch -c feat/browser-export-engine
```

Expected: merge completes without conflicts (the docs branch only adds `docs/`).

- [ ] **Step 4: Verify the baseline is green**

Run: `npm run verify:lint && npm run verify:typecheck && npm run verify:unit`
Expected: all pass (42 unit tests).

---

### Task 2: Output dimensions and bitrate

**Files:**
- Modify: `shared/videoGeometry.ts`
- Test: `shared/videoGeometry.test.ts`

**Interfaces:**
- Produces:
  - `computeOutputDimensions(width: number, height: number): { width: number; height: number }`
  - `computeVideoBitrate(width: number, height: number): number`
  - `MAX_LONG_SIDE = 1920`, `MAX_SHORT_SIDE = 1080`

`computeOutputDimensions` currently has no callers (the server inlines its own formula), so its signature can change.

- [ ] **Step 1: Write the failing test**

Create `shared/videoGeometry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/videoGeometry.test.ts`
Expected: FAIL (`computeVideoBitrate` is not exported; portrait case returns 608x1080).

- [ ] **Step 3: Write the implementation**

Replace `shared/videoGeometry.ts` with:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_LONG_SIDE = 1920;
export const MAX_SHORT_SIDE = 1080;

const REFERENCE_PIXELS = 1920 * 1080;
const REFERENCE_BITRATE = 8_000_000;
const MIN_BITRATE = 2_000_000;

const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

// Input is display dimensions (rotation already applied). Orientation is preserved.
export function computeOutputDimensions(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`Invalid video dimensions: ${width}x${height}`);
  }
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(width, height), MAX_SHORT_SIDE / Math.min(width, height));
  return { width: toEven(width * scale), height: toEven(height * scale) };
}

export function computeVideoBitrate(width: number, height: number): number {
  return Math.max(MIN_BITRATE, Math.round((REFERENCE_BITRATE * width * height) / REFERENCE_PIXELS));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/videoGeometry.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/videoGeometry.ts shared/videoGeometry.test.ts
git commit -m "feat(shared): output dimensions keep orientation, add bitrate rule

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Export validation in shared/

**Files:**
- Create: `shared/exportValidation.ts`
- Test: `shared/exportValidation.test.ts`

**Interfaces:**
- Consumes: `Annotation`, `FreezeAnnotation` from `shared/annotations.ts`.
- Produces:
  - `EXPORT_LIMITS` constants
  - `type ExportValidationCode`
  - `type ExportValidationResult = { valid: boolean; code?: ExportValidationCode; message?: string }`
  - `validateExport(input: { clip: { startTime: number; endTime: number }; sourceDuration: number; annotations: Annotation[] }): ExportValidationResult`

Rules and Danish messages are copied from `server/src/routes/exportRoutes.ts:144-310`. The server keeps its own copy until PR C deletes it.

- [ ] **Step 1: Write the failing test**

Create `shared/exportValidation.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/exportValidation.test.ts`
Expected: FAIL (cannot resolve `./exportValidation`).

- [ ] **Step 3: Write the implementation**

Create `shared/exportValidation.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, FreezeAnnotation } from "./annotations";

export const EXPORT_LIMITS = {
  minClipSeconds: 0.5,
  maxClipSeconds: 90,
  endToleranceSeconds: 0.5,
  maxAnnotations: 100,
  maxTexts: 50,
  maxShapes: 50,
  maxTextLength: 120,
  freezeDurations: [2, 3, 5],
  minFreezeGapSeconds: 0.05,
  maxTotalFreezeSeconds: 30,
} as const;

export type ExportValidationCode =
  | "INVALID_CLIP"
  | "INVALID_START_TIME"
  | "CLIP_TOO_SHORT"
  | "CLIP_TOO_LONG"
  | "INVALID_END_TIME"
  | "TOO_MANY_ANNOTATIONS"
  | "INVALID_FREEZE_DURATION"
  | "INVALID_FREEZE_TIME"
  | "DUPLICATE_FREEZE"
  | "TOO_MUCH_FREEZE"
  | "TEXT_TOO_LONG"
  | "INVALID_ANNOTATION_TIME"
  | "INVALID_COORDINATES"
  | "INVALID_RADIUS"
  | "INVALID_TYPE"
  | "TOO_MANY_TEXTS"
  | "TOO_MANY_SHAPES";

export type ExportValidationResult = { valid: boolean; code?: ExportValidationCode; message?: string };

export type ExportValidationInput = {
  clip: { startTime: number; endTime: number };
  sourceDuration: number;
  annotations: Annotation[];
};

const fail = (code: ExportValidationCode, message: string): ExportValidationResult => ({ valid: false, code, message });
const inUnitRange = (...values: number[]) => values.every((v) => typeof v === "number" && v >= 0 && v <= 1);

export function validateExport({ clip, sourceDuration, annotations }: ExportValidationInput): ExportValidationResult {
  if (typeof clip?.startTime !== "number" || typeof clip?.endTime !== "number") {
    return fail("INVALID_CLIP", "Ugyldige klipgrænser defineret.");
  }
  if (clip.startTime < 0) {
    return fail("INVALID_START_TIME", "Starttidspunktet kan ikke være negativt.");
  }
  const clipDuration = clip.endTime - clip.startTime;
  if (clipDuration < EXPORT_LIMITS.minClipSeconds) {
    return fail("CLIP_TOO_SHORT", "Det valgte klip skal være mindst 0,5 sekunder.");
  }
  if (clipDuration > EXPORT_LIMITS.maxClipSeconds) {
    return fail("CLIP_TOO_LONG", `Det valgte klip kan højst være ${EXPORT_LIMITS.maxClipSeconds} sekunder i denne version.`);
  }
  if (clip.endTime > sourceDuration + EXPORT_LIMITS.endToleranceSeconds) {
    return fail("INVALID_END_TIME", "Sluttidspunktet ligger ud over videoens faktiske varighed.");
  }
  if (!Array.isArray(annotations)) {
    return fail("INVALID_TYPE", "Annotationer skal leveres som et array.");
  }
  if (annotations.length > EXPORT_LIMITS.maxAnnotations) {
    return fail("TOO_MANY_ANNOTATIONS", "Der kan højst tilføjes 100 annotationer pr. klip.");
  }

  const freezes = annotations
    .filter((a): a is FreezeAnnotation => a?.type === "freeze")
    .sort((a, b) => a.time - b.time);
  let lastFreezeTime = -Infinity;
  let totalFreeze = 0;
  for (const f of freezes) {
    if (!(EXPORT_LIMITS.freezeDurations as readonly number[]).includes(f.duration)) {
      return fail("INVALID_FREEZE_DURATION", "Varighed af frysebillede skal være 2, 3 eller 5 sekunder.");
    }
    if (f.time < clip.startTime || f.time > clip.endTime) {
      return fail("INVALID_FREEZE_TIME", "Frysepunktet ligger uden for klippets tidsramme.");
    }
    if (Math.abs(f.time - lastFreezeTime) < EXPORT_LIMITS.minFreezeGapSeconds) {
      return fail("DUPLICATE_FREEZE", "To frysepunkter må ikke ligge på samme kildetidspunkt eller meget tæt på hinanden.");
    }
    lastFreezeTime = f.time;
    totalFreeze += f.duration;
  }
  if (totalFreeze > EXPORT_LIMITS.maxTotalFreezeSeconds) {
    return fail("TOO_MUCH_FREEZE", "Den samlede frysetid må højst være 30 sekunder.");
  }

  let texts = 0;
  let shapes = 0;
  const timeInvalid = (a: { startTime: number; endTime: number }) =>
    a.startTime < 0 || a.endTime < a.startTime || a.startTime > clip.endTime || a.endTime < clip.startTime;

  for (const a of annotations) {
    switch (a?.type) {
      case "text":
        texts++;
        if (typeof a.text !== "string" || a.text.length > EXPORT_LIMITS.maxTextLength) {
          return fail("TEXT_TOO_LONG", "En tekstannotation må højst indeholde 120 tegn.");
        }
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En tekstannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.x, a.y)) return fail("INVALID_COORDINATES", "Koordinater skal være mellem 0 og 1.");
        break;
      case "circle":
        shapes++;
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En cirkelannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.x, a.y)) return fail("INVALID_COORDINATES", "Koordinater skal være mellem 0 og 1.");
        if (!(a.radius > 0 && a.radius <= 1)) return fail("INVALID_RADIUS", "Radius skal være mellem 0 og 1.");
        break;
      case "arrow":
        shapes++;
        if (timeInvalid(a)) return fail("INVALID_ANNOTATION_TIME", "En pilannotation har ugyldige tidsgrænser.");
        if (!inUnitRange(a.startX, a.startY, a.endX, a.endY)) {
          return fail("INVALID_COORDINATES", "Pilespidskoordinater skal være mellem 0 og 1.");
        }
        break;
      case "freeze":
        break;
      default:
        return fail("INVALID_TYPE", "Ugyldig annotationstype fundet.");
    }
  }
  if (texts > EXPORT_LIMITS.maxTexts) return fail("TOO_MANY_TEXTS", "Du kan højst tilføje 50 tekstannotationer.");
  if (shapes > EXPORT_LIMITS.maxShapes) {
    return fail("TOO_MANY_SHAPES", "Du kan højst tilføje 50 geometriske markeringer (cirkler/pile).");
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/exportValidation.test.ts`
Expected: PASS (17 tests). Note the "more than 100 annotations" test builds 101 texts, so the annotation count check must run before the per-type count check (it does).

- [ ] **Step 5: Commit**

```bash
git add shared/exportValidation.ts shared/exportValidation.test.ts
git commit -m "feat(shared): move export validation rules into shared/

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Segment planning

**Files:**
- Create: `src/export/planSegments.ts`
- Test: `src/export/planSegments.test.ts`

**Interfaces:**
- Consumes: `Annotation`, `FreezeAnnotation` from `shared/annotations.ts`.
- Produces:
  - `type VideoSegment = { type: "video"; start: number; end: number; frameCount: number; outputStartFrame: number }`
  - `type FreezeSegment = { type: "freeze"; time: number; duration: number; frameCount: number; outputStartFrame: number }`
  - `type ExportSegment = VideoSegment | FreezeSegment`
  - `type ExportPlan = { segments: ExportSegment[]; totalFrames: number; fps: number }`
  - `planSegments(clip: { startTime: number; endTime: number }, annotations: Annotation[], fps: number): ExportPlan`
  - `MIN_SEGMENT_SECONDS = 0.05`

- [ ] **Step 1: Write the failing test**

Create `src/export/planSegments.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/planSegments.test.ts`
Expected: FAIL (cannot resolve `./planSegments`).

- [ ] **Step 3: Write the implementation**

Create `src/export/planSegments.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, FreezeAnnotation } from "../../shared/annotations";

export const MIN_SEGMENT_SECONDS = 0.05;

export type VideoSegment = { type: "video"; start: number; end: number; frameCount: number; outputStartFrame: number };
export type FreezeSegment = { type: "freeze"; time: number; duration: number; frameCount: number; outputStartFrame: number };
export type ExportSegment = VideoSegment | FreezeSegment;
export type ExportPlan = { segments: ExportSegment[]; totalFrames: number; fps: number };

// A freeze inserts output time at f.time; playback resumes from f.time afterwards.
export function planSegments(
  clip: { startTime: number; endTime: number },
  annotations: Annotation[],
  fps: number
): ExportPlan {
  const { startTime: start, endTime: end } = clip;
  const freezes = annotations
    .filter((a): a is FreezeAnnotation => a.type === "freeze" && a.time >= start && a.time <= end && a.duration > 0)
    .sort((a, b) => a.time - b.time);

  const segments: ExportSegment[] = [];
  let outputFrame = 0;
  let currentPos = start;
  let lastFreezeTime = -Infinity;

  const pushVideo = (from: number, to: number) => {
    if (to - from <= MIN_SEGMENT_SECONDS) return;
    const frameCount = Math.round((to - from) * fps);
    if (frameCount === 0) return;
    segments.push({ type: "video", start: from, end: to, frameCount, outputStartFrame: outputFrame });
    outputFrame += frameCount;
  };

  for (const f of freezes) {
    if (f.time - lastFreezeTime < MIN_SEGMENT_SECONDS) continue;
    lastFreezeTime = f.time;
    pushVideo(currentPos, f.time);
    const frameCount = Math.round(f.duration * fps);
    segments.push({ type: "freeze", time: f.time, duration: f.duration, frameCount, outputStartFrame: outputFrame });
    outputFrame += frameCount;
    currentPos = f.time;
  }
  pushVideo(currentPos, end);

  if (segments.length === 0) throw new Error("EMPTY_PLAN");
  return { segments, totalFrames: outputFrame, fps };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/export/planSegments.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/export/planSegments.ts src/export/planSegments.test.ts
git commit -m "feat(export): plan frame-quantized video and freeze segments

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Canvas geometry in shared/annotationGeometry.ts

**Files:**
- Modify: `shared/annotationGeometry.ts` (append; refactor `getTextGeometry` to reuse `wrapTextLines`)
- Test: `shared/annotationGeometry.test.ts`

**Interfaces:**
- Produces:
  - `ANNOTATION_COLORS: { yellow: "#FFB020"; red: "#D64545"; white: "#FFFFFF" }`
  - `ANNOTATION_STYLE` (see code)
  - `getAnnotationScale(width: number, height: number): number`
  - `wrapTextLines(text: string, maxChars?: number): string[]`
  - `type MeasureTextWidth = (line: string, fontSize: number) => number`
  - `type TextLayout = { centerX: number; rectX: number; rectY: number; boxWidth: number; boxHeight: number; cornerRadius: number; fontSize: number; lineHeight: number; firstBaselineY: number; lines: string[] }`
  - `layoutTextAnnotation(width: number, height: number, x: number, y: number, size: string, text: string, measure: MeasureTextWidth): TextLayout`
  - `type ArrowHead = { tipX: number; tipY: number; leftX: number; leftY: number; rightX: number; rightY: number }`
  - `getArrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): ArrowHead | null`

The existing `getCircleGeometry`, `getArrowGeometry`, `getTextGeometry` stay unchanged in behavior (the server and `CircleAnnotationView` still use them) and are removed or replaced in PR C.

- [ ] **Step 1: Write the failing test**

Create `shared/annotationGeometry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getAnnotationScale,
  wrapTextLines,
  layoutTextAnnotation,
  getArrowHead,
  getTextGeometry,
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

  it("matches the legacy getTextGeometry wrapping", () => {
    const text = "Pres højt og luk midten hurtigt ned";
    expect(wrapTextLines(text)).toEqual(getTextGeometry(1920, 1080, 0.5, 0.5, "normal", text).lines);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/annotationGeometry.test.ts`
Expected: FAIL (`getAnnotationScale` is not exported).

- [ ] **Step 3: Write the implementation**

In `shared/annotationGeometry.ts`, replace the wrapping loop inside `getTextGeometry` (lines 89-102, from `// Split lines` through `if (currentLine) lines.push(currentLine);`) with:

```ts
  const lines = wrapTextLines(text);
```

Then append to the end of the file:

```ts
// ---- Canvas rendering geometry (shared by browser preview and browser export) ----

export const ANNOTATION_COLORS = {
  yellow: "#FFB020",
  red: "#D64545",
  white: "#FFFFFF",
} as const;

// Pixel values are for an output whose short side is 1080 px; multiply by getAnnotationScale().
export const ANNOTATION_STYLE = {
  referenceShortSide: 1080,
  circleStrokeBold: 8,
  circleStrokeNormal: 4,
  circleDash: 8,
  circleFill: "rgba(255, 176, 32, 0.05)",
  arrowStroke: 6,
  arrowHeadLengthFactor: 6,
  arrowHeadWidthFactor: 4.8,
  arrowTipOvershootFactor: 2.4,
  textColor: "#FFFFFF",
  textBackground: TEXT_GEOMETRY.bgColor,
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: "bold",
  cornerRadiusFactor: 0.22,
  firstBaselineFactor: 0.85,
} as const;

export function getAnnotationScale(width: number, height: number): number {
  return Math.min(width, height) / ANNOTATION_STYLE.referenceShortSide;
}

export function wrapTextLines(text: string, maxChars: number = TEXT_GEOMETRY.maxCharsPerLine): string[] {
  const lines: string[] = [];
  let currentLine = "";
  for (const word of text.split(" ")) {
    if ((currentLine + " " + word).trim().length <= maxChars) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export type MeasureTextWidth = (line: string, fontSize: number) => number;

export type TextLayout = {
  centerX: number;
  rectX: number;
  rectY: number;
  boxWidth: number;
  boxHeight: number;
  cornerRadius: number;
  fontSize: number;
  lineHeight: number;
  firstBaselineY: number;
  lines: string[];
};

export function layoutTextAnnotation(
  width: number,
  height: number,
  x: number,
  y: number,
  size: string,
  text: string,
  measure: MeasureTextWidth
): TextLayout {
  const sizeKey = size in TEXT_GEOMETRY.fontSizes ? (size as keyof typeof TEXT_GEOMETRY.fontSizes) : "normal";
  const fontSize = TEXT_GEOMETRY.fontSizes[sizeKey] * Math.min(width, height);
  const paddingX = fontSize * TEXT_GEOMETRY.paddingXFactor;
  const paddingY = fontSize * TEXT_GEOMETRY.paddingYFactor;
  const lineHeight = fontSize * TEXT_GEOMETRY.lineHeightFactor;
  const lines = wrapTextLines(text);
  const widest = lines.reduce((max, line) => Math.max(max, measure(line, fontSize)), 0);
  const boxWidth = widest + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const centerX = x * width;
  const rectX = centerX - boxWidth / 2;
  const rectY = y * height - boxHeight / 2;
  return {
    centerX,
    rectX,
    rectY,
    boxWidth,
    boxHeight,
    cornerRadius: fontSize * ANNOTATION_STYLE.cornerRadiusFactor,
    fontSize,
    lineHeight,
    firstBaselineY: rectY + paddingY + fontSize * ANNOTATION_STYLE.firstBaselineFactor,
    lines,
  };
}

export type ArrowHead = { tipX: number; tipY: number; leftX: number; leftY: number; rightX: number; rightY: number };

// Same shape as the former SVG marker: 6 × 4.8 stroke widths, tip 2.4 stroke widths past the line end.
export function getArrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): ArrowHead | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  const tipX = x2 + ux * ANNOTATION_STYLE.arrowTipOvershootFactor * strokeWidth;
  const tipY = y2 + uy * ANNOTATION_STYLE.arrowTipOvershootFactor * strokeWidth;
  const baseX = tipX - ux * ANNOTATION_STYLE.arrowHeadLengthFactor * strokeWidth;
  const baseY = tipY - uy * ANNOTATION_STYLE.arrowHeadLengthFactor * strokeWidth;
  const half = (ANNOTATION_STYLE.arrowHeadWidthFactor * strokeWidth) / 2;
  return {
    tipX,
    tipY,
    leftX: baseX - uy * half,
    leftY: baseY + ux * half,
    rightX: baseX + uy * half,
    rightY: baseY - ux * half,
  };
}
```

- [ ] **Step 4: Run the new and the existing geometry tests**

Run: `npx vitest run shared/annotationGeometry.test.ts server/tests/export.test.ts`
Expected: PASS (new: 10 tests; existing export tests unchanged and green).

- [ ] **Step 5: Commit**

```bash
git add shared/annotationGeometry.ts shared/annotationGeometry.test.ts
git commit -m "feat(shared): canvas annotation geometry with measured text and scale

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: renderAnnotations

**Files:**
- Create: `src/export/renderAnnotations.ts`
- Test: `src/export/renderAnnotations.test.ts`

**Interfaces:**
- Consumes: from `shared/annotationGeometry.ts`: `ANNOTATION_COLORS`, `ANNOTATION_STYLE`, `getAnnotationScale`, `layoutTextAnnotation`, `getArrowHead`, `getCircleGeometry`, `getArrowGeometry`. Types from `shared/annotations.ts`.
- Produces:
  - `type AnnotationContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`
  - `isAnnotationActive(annotation: Annotation, time: number): boolean`
  - `renderAnnotations(ctx: AnnotationContext2D, width: number, height: number, annotations: Annotation[], time: number): void`

- [ ] **Step 1: Write the failing test**

Create `src/export/renderAnnotations.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/renderAnnotations.test.ts`
Expected: FAIL (cannot resolve `./renderAnnotations`).

- [ ] **Step 3: Write the implementation**

Create `src/export/renderAnnotations.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Annotation, ArrowAnnotation, CircleAnnotation, TextAnnotation } from "../../shared/annotations";
import {
  ANNOTATION_COLORS,
  ANNOTATION_STYLE,
  getAnnotationScale,
  getArrowGeometry,
  getArrowHead,
  getCircleGeometry,
  layoutTextAnnotation,
} from "../../shared/annotationGeometry";

export type AnnotationContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function isAnnotationActive(annotation: Annotation, time: number): boolean {
  return annotation.type !== "freeze" && annotation.startTime <= time && time <= annotation.endTime;
}

const fontFor = (fontSize: number) => `${ANNOTATION_STYLE.fontWeight} ${fontSize}px ${ANNOTATION_STYLE.fontFamily}`;

function drawCircle(ctx: AnnotationContext2D, width: number, height: number, a: CircleAnnotation, scale: number) {
  const { radiusPx } = getCircleGeometry(width, height, a.radius);
  const bold = a.thickness === "bold";
  ctx.beginPath();
  ctx.arc(a.x * width, a.y * height, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = ANNOTATION_STYLE.circleFill;
  ctx.fill();
  ctx.lineWidth = (bold ? ANNOTATION_STYLE.circleStrokeBold : ANNOTATION_STYLE.circleStrokeNormal) * scale;
  ctx.strokeStyle = ANNOTATION_COLORS[a.color] ?? ANNOTATION_COLORS.white;
  ctx.setLineDash(bold ? [] : [ANNOTATION_STYLE.circleDash * scale, ANNOTATION_STYLE.circleDash * scale]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawArrow(ctx: AnnotationContext2D, width: number, height: number, a: ArrowAnnotation, scale: number) {
  const { x1, y1, x2, y2 } = getArrowGeometry(width, height, a.startX, a.startY, a.endX, a.endY);
  const strokeWidth = ANNOTATION_STYLE.arrowStroke * scale;
  const color = ANNOTATION_COLORS[a.color] ?? ANNOTATION_COLORS.white;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
  const head = getArrowHead(x1, y1, x2, y2, strokeWidth);
  if (!head) return;
  ctx.beginPath();
  ctx.moveTo(head.tipX, head.tipY);
  ctx.lineTo(head.leftX, head.leftY);
  ctx.lineTo(head.rightX, head.rightY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawText(ctx: AnnotationContext2D, width: number, height: number, a: TextAnnotation) {
  const measure = (line: string, fontSize: number) => {
    ctx.font = fontFor(fontSize);
    return ctx.measureText(line).width;
  };
  const layout = layoutTextAnnotation(width, height, a.x, a.y, a.size, a.text, measure);
  if (layout.lines.length === 0) return;
  ctx.beginPath();
  ctx.fillStyle = ANNOTATION_STYLE.textBackground;
  ctx.roundRect(layout.rectX, layout.rectY, layout.boxWidth, layout.boxHeight, layout.cornerRadius);
  ctx.fill();
  ctx.font = fontFor(layout.fontSize);
  ctx.fillStyle = ANNOTATION_STYLE.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, layout.centerX, layout.firstBaselineY + index * layout.lineHeight);
  });
}

// Draws every non-freeze annotation active at `time` (source seconds) onto an output of width × height.
export function renderAnnotations(
  ctx: AnnotationContext2D,
  width: number,
  height: number,
  annotations: Annotation[],
  time: number
): void {
  const scale = getAnnotationScale(width, height);
  for (const annotation of annotations) {
    if (!isAnnotationActive(annotation, time)) continue;
    ctx.save();
    if (annotation.type === "circle") drawCircle(ctx, width, height, annotation, scale);
    else if (annotation.type === "arrow") drawArrow(ctx, width, height, annotation, scale);
    else if (annotation.type === "text") drawText(ctx, width, height, annotation);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/export/renderAnnotations.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/export/renderAnnotations.ts src/export/renderAnnotations.test.ts
git commit -m "feat(export): draw annotations on canvas from shared geometry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Add Mediabunny, export errors and capability detection

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/export/exportErrors.ts`, `src/export/capabilities.ts`
- Test: `src/export/exportErrors.test.ts`, `src/export/capabilities.test.ts`

**Interfaces:**
- Produces (exportErrors.ts):
  - `type ExportErrorCode = "UNSUPPORTED_BROWSER" | "UNREADABLE_VIDEO" | "INVALID_PROJECT" | "STORAGE_FULL" | "INTERRUPTED" | "CANCELLED" | "UNKNOWN"`
  - `EXPORT_ERROR_MESSAGES: Record<ExportErrorCode, string>`
  - `AUDIO_WARNING_MESSAGE: string`
  - `class ExportError extends Error { readonly code: ExportErrorCode }` with `constructor(code: ExportErrorCode, options?: { message?: string; cause?: unknown })`
  - `toExportError(error: unknown, context: { cancelled: boolean; wasHidden: boolean }): ExportError`
- Produces (capabilities.ts):
  - `type CapabilityProbe = { hasWebCodecs: boolean; hasOffscreenCanvas: boolean; hasOpfsWritable: boolean; canShareFiles: boolean; canEncodeH264: (width: number, height: number) => Promise<boolean>; canEncodeAac: () => Promise<boolean> }`
  - `type ExportCapabilities = { supported: boolean; reason?: "NO_WEBCODECS" | "NO_OFFSCREEN_CANVAS" | "NO_H264_ENCODER"; nativeAac: boolean; opfs: boolean; shareFiles: boolean }`
  - `browserCapabilityProbe(): CapabilityProbe`
  - `detectExportCapabilities(probe?: CapabilityProbe, size?: { width: number; height: number }): Promise<ExportCapabilities>`

`INVALID_PROJECT` is not in the spec's error table; it carries the Danish message from `validateExport` when a project fails validation (the UI prevents this in practice, the engine still guards).

- [ ] **Step 1: Install pinned dependencies**

Run: `npm install --save-exact mediabunny@1.56.2 @mediabunny/aac-encoder@1.56.2`
Expected: `package.json` `dependencies` contains `"mediabunny": "1.56.2"` and `"@mediabunny/aac-encoder": "1.56.2"`.

- [ ] **Step 2: Write the failing tests**

Create `src/export/exportErrors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ExportError, toExportError, EXPORT_ERROR_MESSAGES } from "./exportErrors";

describe("ExportError", () => {
  it("uses the Danish message for its code by default", () => {
    const error = new ExportError("STORAGE_FULL");
    expect(error.code).toBe("STORAGE_FULL");
    expect(error.message).toBe("Der er ikke plads nok på enheden til klippet. Frigør plads, og prøv igen.");
    expect(error.name).toBe("ExportError");
  });

  it("accepts a custom message and cause", () => {
    const cause = new Error("inner");
    const error = new ExportError("INVALID_PROJECT", { message: "Det valgte klip skal være mindst 0,5 sekunder.", cause });
    expect(error.message).toBe("Det valgte klip skal være mindst 0,5 sekunder.");
    expect(error.cause).toBe(cause);
  });
});

describe("toExportError", () => {
  const plain = { cancelled: false, wasHidden: false };

  it("returns an existing ExportError unchanged", () => {
    const original = new ExportError("UNREADABLE_VIDEO");
    expect(toExportError(original, { cancelled: true, wasHidden: true })).toBe(original);
  });

  it("maps to CANCELLED when the signal was aborted", () => {
    expect(toExportError(new Error("x"), { cancelled: true, wasHidden: true }).code).toBe("CANCELLED");
  });

  it("maps QuotaExceededError to STORAGE_FULL", () => {
    const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
    expect(toExportError(quota, plain).code).toBe("STORAGE_FULL");
  });

  it("maps failures after the page was hidden to INTERRUPTED", () => {
    expect(toExportError(new Error("EncodingError"), { cancelled: false, wasHidden: true }).code).toBe("INTERRUPTED");
  });

  it("maps everything else to UNKNOWN with the reassuring message", () => {
    const error = toExportError("boom", plain);
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe(EXPORT_ERROR_MESSAGES.UNKNOWN);
    expect(error.cause).toBe("boom");
  });
});
```

Create `src/export/capabilities.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/export/exportErrors.test.ts src/export/capabilities.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Write the implementations**

Create `src/export/exportErrors.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExportErrorCode =
  | "UNSUPPORTED_BROWSER"
  | "UNREADABLE_VIDEO"
  | "INVALID_PROJECT"
  | "STORAGE_FULL"
  | "INTERRUPTED"
  | "CANCELLED"
  | "UNKNOWN";

export const EXPORT_ERROR_MESSAGES: Record<ExportErrorCode, string> = {
  UNSUPPORTED_BROWSER:
    "Din browser kan ikke lave klip. Opdatér til iOS 26 eller nyere, eller brug Chrome, Edge eller Safari på en computer.",
  UNREADABLE_VIDEO: "Videoen kan ikke læses i denne browser. Prøv en anden video eller en anden browser.",
  INVALID_PROJECT: "Klippet kunne ikke oprettes, fordi projektets indstillinger er ugyldige.",
  STORAGE_FULL: "Der er ikke plads nok på enheden til klippet. Frigør plads, og prøv igen.",
  INTERRUPTED: "Eksporten stoppede, fordi skærmen blev slukket eller appen lukket. Prøv igen, og hold skærmen tændt.",
  CANCELLED: "Eksporten blev afbrudt.",
  UNKNOWN: "Klippet kunne ikke oprettes. Projektet og dine markeringer er dog stadig gemt.",
};

export const AUDIO_WARNING_MESSAGE = "Klippet er lavet uden lyd, fordi lyden i videoen ikke kunne læses.";

export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, options: { message?: string; cause?: unknown } = {}) {
    super(options.message ?? EXPORT_ERROR_MESSAGES[code], { cause: options.cause });
    this.name = "ExportError";
    this.code = code;
  }
}

const hasName = (error: unknown, name: string) =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === name;

export function toExportError(error: unknown, context: { cancelled: boolean; wasHidden: boolean }): ExportError {
  if (error instanceof ExportError) return error;
  if (context.cancelled) return new ExportError("CANCELLED", { cause: error });
  if (hasName(error, "QuotaExceededError")) return new ExportError("STORAGE_FULL", { cause: error });
  if (context.wasHidden) return new ExportError("INTERRUPTED", { cause: error });
  return new ExportError("UNKNOWN", { cause: error });
}
```

Create `src/export/capabilities.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/export/exportErrors.test.ts src/export/capabilities.test.ts`
Expected: PASS (7 + 6 tests). If importing `mediabunny` in Node fails, stop and report the error; do not stub it.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: no errors, no new warnings.

```bash
git add package.json package-lock.json src/export/exportErrors.ts src/export/exportErrors.test.ts src/export/capabilities.ts src/export/capabilities.test.ts
git commit -m "feat(export): add Mediabunny, export error codes and capability detection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Browser modules (storage, audio, orchestrator, delivery)

These modules need WebCodecs, OPFS and Web Audio and are verified by the browser tests in Task 10. This task ends with typecheck + lint green; behavior is proven in Task 10.

**Files:**
- Create: `src/export/exportStorage.ts`, `src/export/decodeClipAudio.ts`, `src/export/exportClip.ts`, `src/export/deliverClip.ts`

**Interfaces:**
- Consumes: Tasks 2–7 exports; from `shared/exportSchema.ts`: `sanitizeExportFileName(title: string): string`; `CoachClipProject` from `src/types.ts`.
- Produces (exportStorage.ts):
  - `EXPORT_FILE_PREFIX = "coachclip-export-"`
  - `type ExportSink = { kind: "opfs" | "memory"; target: StreamTarget | BufferTarget; fastStart: false | "in-memory"; getFile: (fileName: string) => Promise<File>; discard: () => Promise<void> }`
  - `createExportSink(options?: { forceMemory?: boolean }): Promise<ExportSink>`
  - `clearExportFiles(): Promise<void>`
  - `listExportFiles(): Promise<string[]>`
- Produces (decodeClipAudio.ts):
  - `type DecodedClipAudio = { samples: AudioSample[]; sampleRate: number; numberOfChannels: number; path: "webcodecs" | "webaudio" }`
  - `decodeClipAudio(input: Input, track: InputAudioTrack, range: { start: number; end: number }, options?: { forceWebAudio?: boolean }): Promise<DecodedClipAudio | null>`
  - `appendAudioRange(source: AudioSampleSource, audio: DecodedClipAudio, start: number, end: number, outputStart: number): Promise<void>`
  - `appendSilence(source: AudioSampleSource, audio: DecodedClipAudio, durationSec: number, outputStart: number): Promise<void>`
  - `closeDecodedAudio(audio: DecodedClipAudio | null): void`
- Produces (exportClip.ts):
  - `EXPORT_FPS = 30`
  - `type ExportStage = "preparing" | "decoding_audio" | "rendering" | "finalizing"`
  - `type ExportProgress = { stage: ExportStage; fraction: number }`
  - `type ExportedClip = { file: File; fileName: string; durationSec: number; sizeBytes: number; width: number; height: number; hasAudio: boolean; audioPath?: "webcodecs" | "webaudio"; audioWarning?: "AUDIO_UNREADABLE" }`
  - `type ExportClipOptions = { file: File; project: Pick<CoachClipProject, "title" | "clip" | "annotations">; signal: AbortSignal; onProgress?: (progress: ExportProgress) => void; overrides?: { forceWebAudio?: boolean; forceMemoryStorage?: boolean } }`
  - `exportClip(options: ExportClipOptions): Promise<ExportedClip>` — rejects only with `ExportError`
  - `EXPORT_STAGE_LABELS: Record<ExportStage, string>`
- Produces (deliverClip.ts):
  - `type DeliveryResult = "shared" | "downloaded" | "dismissed"`
  - `deliverClip(clip: Pick<ExportedClip, "file" | "fileName">, mode: "share" | "download"): Promise<DeliveryResult>`

`audioPath` is an addition to the spec's `ExportedClip` so tests can assert which audio path ran; the UI ignores it. `overrides` exists only for the browser tests.

- [ ] **Step 1: Create `src/export/exportStorage.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferTarget, StreamTarget, type StreamTargetChunk } from "mediabunny";

export const EXPORT_FILE_PREFIX = "coachclip-export-";

export type ExportSink = {
  kind: "opfs" | "memory";
  target: StreamTarget | BufferTarget;
  fastStart: false | "in-memory";
  getFile: (fileName: string) => Promise<File>;
  discard: () => Promise<void>;
};

type DirectoryWithKeys = FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };

const supportsOpfsWritable = () =>
  typeof navigator !== "undefined" &&
  !!navigator.storage?.getDirectory &&
  typeof FileSystemFileHandle !== "undefined" &&
  "createWritable" in FileSystemFileHandle.prototype;

function createMemorySink(): ExportSink {
  const target = new BufferTarget();
  return {
    kind: "memory",
    target,
    fastStart: "in-memory",
    getFile: async (fileName) => {
      if (!target.buffer) throw new Error("Export buffer is empty");
      return new File([target.buffer], fileName, { type: "video/mp4" });
    },
    discard: async () => {},
  };
}

export async function createExportSink(options: { forceMemory?: boolean } = {}): Promise<ExportSink> {
  if (options.forceMemory || !supportsOpfsWritable()) return createMemorySink();

  const root = await navigator.storage.getDirectory();
  const name = `${EXPORT_FILE_PREFIX}${crypto.randomUUID()}.mp4`;
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  let closed = false;

  const stream = new WritableStream<StreamTargetChunk>({
    write: (chunk) => writable.write({ type: "write", position: chunk.position, data: chunk.data }),
    close: async () => {
      closed = true;
      await writable.close();
    },
    abort: async () => {
      closed = true;
      await writable.abort();
    },
  });

  return {
    kind: "opfs",
    target: new StreamTarget(stream, { chunked: true }),
    fastStart: false,
    getFile: async (fileName) => new File([await handle.getFile()], fileName, { type: "video/mp4" }),
    discard: async () => {
      if (!closed) await writable.abort().catch(() => {});
      await root.removeEntry(name).catch(() => {});
    },
  };
}

export async function listExportFiles(): Promise<string[]> {
  if (!supportsOpfsWritable()) return [];
  const root = (await navigator.storage.getDirectory()) as DirectoryWithKeys;
  const names: string[] = [];
  for await (const name of root.keys()) {
    if (name.startsWith(EXPORT_FILE_PREFIX)) names.push(name);
  }
  return names;
}

export async function clearExportFiles(): Promise<void> {
  if (!supportsOpfsWritable()) return;
  const root = await navigator.storage.getDirectory();
  for (const name of await listExportFiles()) {
    await root.removeEntry(name).catch(() => {});
  }
}
```

- [ ] **Step 2: Create `src/export/decodeClipAudio.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AudioSample,
  AudioSampleSink,
  BufferTarget,
  Conversion,
  Mp4OutputFormat,
  Output,
  type AudioSampleSource,
  type Input,
  type InputAudioTrack,
} from "mediabunny";

export type DecodedClipAudio = {
  samples: AudioSample[];
  sampleRate: number;
  numberOfChannels: number;
  path: "webcodecs" | "webaudio";
};

const toDecodedAudio = (samples: AudioSample[], path: DecodedClipAudio["path"]): DecodedClipAudio | null =>
  samples.length === 0
    ? null
    : { samples, sampleRate: samples[0].sampleRate, numberOfChannels: samples[0].numberOfChannels, path };

async function decodeWithWebCodecs(track: InputAudioTrack, start: number, end: number): Promise<DecodedClipAudio | null> {
  if (!(await track.canDecode())) throw new Error("Audio track cannot be decoded with WebCodecs");
  const samples: AudioSample[] = [];
  try {
    for await (const sample of new AudioSampleSink(track).samples(start, end)) samples.push(sample);
  } catch (error) {
    samples.forEach((s) => s.close());
    throw error;
  }
  return toDecodedAudio(samples, "webcodecs");
}

// WebKit's AudioDecoder rejects some AAC streams; copying the packets and decoding with
// Web Audio uses the platform decoder instead.
async function decodeWithWebAudio(input: Input, start: number, end: number): Promise<DecodedClipAudio | null> {
  const audioOnly = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output: audioOnly,
    trim: { start, end },
    video: { discard: true },
    audio: { forceTranscode: false },
  });
  if (!conversion.isValid) throw new Error("Audio could not be copied for Web Audio decoding");
  await conversion.execute();
  const bytes = audioOnly.target.buffer;
  if (!bytes) throw new Error("Audio copy produced no data");
  const buffer = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes.slice(0));
  return toDecodedAudio(AudioSample.fromAudioBuffer(buffer, start), "webaudio");
}

// Returns samples timestamped in source seconds, or null when the audio cannot be read at all.
export async function decodeClipAudio(
  input: Input,
  track: InputAudioTrack,
  range: { start: number; end: number },
  options: { forceWebAudio?: boolean } = {}
): Promise<DecodedClipAudio | null> {
  if (!options.forceWebAudio) {
    try {
      return await decodeWithWebCodecs(track, range.start, range.end);
    } catch {
      // fall through to Web Audio
    }
  }
  try {
    return await decodeWithWebAudio(input, range.start, range.end);
  } catch {
    return null;
  }
}

export async function appendAudioRange(
  source: AudioSampleSource,
  audio: DecodedClipAudio,
  start: number,
  end: number,
  outputStart: number
): Promise<void> {
  for (const sample of audio.samples) {
    if (sample.timestamp + sample.duration <= start || sample.timestamp >= end) continue;
    const rate = sample.sampleRate;
    const from = Math.max(0, Math.round((start - sample.timestamp) * rate));
    const to = Math.min(sample.numberOfFrames, Math.round((end - sample.timestamp) * rate));
    if (to <= from) continue;
    const piece = sample.trim(from, to);
    piece.setTimestamp(outputStart + (sample.timestamp + from / rate - start));
    try {
      await source.add(piece);
    } finally {
      piece.close();
    }
  }
}

export async function appendSilence(
  source: AudioSampleSource,
  audio: DecodedClipAudio,
  durationSec: number,
  outputStart: number
): Promise<void> {
  const frames = Math.round(durationSec * audio.sampleRate);
  if (frames <= 0) return;
  const silence = new AudioSample({
    data: new Float32Array(frames * audio.numberOfChannels),
    format: "f32",
    numberOfChannels: audio.numberOfChannels,
    sampleRate: audio.sampleRate,
    timestamp: outputStart,
  });
  try {
    await source.add(silence);
  } finally {
    silence.close();
  }
}

export function closeDecodedAudio(audio: DecodedClipAudio | null): void {
  audio?.samples.forEach((s) => s.close());
}
```

- [ ] **Step 3: Create `src/export/exportClip.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ALL_FORMATS,
  AudioSampleSource,
  BlobSource,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
  canEncodeAudio,
  type VideoSample,
} from "mediabunny";
import { registerAacEncoder } from "@mediabunny/aac-encoder";
import type { CoachClipProject } from "../types";
import { computeOutputDimensions, computeVideoBitrate } from "../../shared/videoGeometry";
import { validateExport } from "../../shared/exportValidation";
import { sanitizeExportFileName } from "../../shared/exportSchema";
import { planSegments, type VideoSegment } from "./planSegments";
import { renderAnnotations } from "./renderAnnotations";
import { ExportError, toExportError } from "./exportErrors";
import { browserCapabilityProbe, detectExportCapabilities } from "./capabilities";
import { createExportSink, type ExportSink } from "./exportStorage";
import { appendAudioRange, appendSilence, closeDecodedAudio, decodeClipAudio, type DecodedClipAudio } from "./decodeClipAudio";

export const EXPORT_FPS = 30;
const AUDIO_BITRATE = 128_000;
const KEYFRAME_INTERVAL_SECONDS = 2;
const PROGRESS_EVERY_FRAMES = 10;

export type ExportStage = "preparing" | "decoding_audio" | "rendering" | "finalizing";
export type ExportProgress = { stage: ExportStage; fraction: number };

export const EXPORT_STAGE_LABELS: Record<ExportStage, string> = {
  preparing: "Forbereder video…",
  decoding_audio: "Afkoder lyd…",
  rendering: "Tegner klip…",
  finalizing: "Gør filen klar…",
};

export type ExportedClip = {
  file: File;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  width: number;
  height: number;
  hasAudio: boolean;
  audioPath?: "webcodecs" | "webaudio";
  audioWarning?: "AUDIO_UNREADABLE";
};

export type ExportClipOptions = {
  file: File;
  project: Pick<CoachClipProject, "title" | "clip" | "annotations">;
  signal: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  overrides?: { forceWebAudio?: boolean; forceMemoryStorage?: boolean };
};

let aacEncoderRegistered = false;

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new ExportError("CANCELLED");
};

// Yields, for each target time, the latest decoded frame whose timestamp is <= that time.
async function* framesAtTimes(sink: VideoSampleSink, segment: VideoSegment, times: number[]) {
  const iterator = sink.samples(segment.start, segment.end)[Symbol.asyncIterator]();
  // VideoSample.draw applies the track's rotation metadata, so portrait phone video is drawn upright.
  let current: VideoSample | null = null;
  let next = await iterator.next();
  try {
    for (const time of times) {
      let changed = false;
      while (!next.done && next.value.timestamp <= time + 1e-6) {
        current?.close();
        current = next.value;
        changed = true;
        next = await iterator.next();
      }
      yield { sample: current, changed };
    }
  } finally {
    current?.close();
    if (!next.done) next.value.close();
    await iterator.return?.(undefined);
  }
}

export async function exportClip(options: ExportClipOptions): Promise<ExportedClip> {
  const { file, project, signal, onProgress = () => {}, overrides = {} } = options;
  let wasHidden = typeof document !== "undefined" && document.hidden;
  const onVisibility = () => {
    if (document.hidden) wasHidden = true;
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  let wakeLock: WakeLockSentinel | null = null;
  let sink: ExportSink | null = null;
  let output: Output | null = null;
  let audio: DecodedClipAudio | null = null;

  try {
    onProgress({ stage: "preparing", fraction: 0 });
    wakeLock = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;

    const videoTrack = await input.getPrimaryVideoTrack().catch(() => null);
    if (!videoTrack || !(await videoTrack.canDecode().catch(() => false))) throw new ExportError("UNREADABLE_VIDEO");

    const validation = validateExport({
      clip: project.clip,
      sourceDuration: await input.computeDuration(),
      annotations: project.annotations,
    });
    if (!validation.valid) throw new ExportError("INVALID_PROJECT", { message: validation.message });

    const { width, height } = computeOutputDimensions(await videoTrack.getDisplayWidth(), await videoTrack.getDisplayHeight());
    const capabilities = await detectExportCapabilities(browserCapabilityProbe(), { width, height });
    if (!capabilities.supported) throw new ExportError("UNSUPPORTED_BROWSER");

    const plan = planSegments(project.clip, project.annotations, EXPORT_FPS);
    throwIfAborted(signal);

    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack) {
      onProgress({ stage: "decoding_audio", fraction: 0.01 });
      audio = await decodeClipAudio(
        input,
        audioTrack,
        { start: project.clip.startTime, end: project.clip.endTime },
        { forceWebAudio: overrides.forceWebAudio }
      );
    }
    throwIfAborted(signal);

    sink = await createExportSink({ forceMemory: overrides.forceMemoryStorage });
    output = new Output({ format: new Mp4OutputFormat({ fastStart: sink.fastStart }), target: sink.target });

    const encoderCanvas = new OffscreenCanvas(width, height);
    const ctx = encoderCanvas.getContext("2d");
    // Holds the latest source frame without annotations, so annotations are never drawn twice.
    const frameCanvas = new OffscreenCanvas(width, height);
    const frameCtx = frameCanvas.getContext("2d");
    if (!ctx || !frameCtx) throw new ExportError("UNSUPPORTED_BROWSER");
    frameCtx.fillStyle = "#000000";
    frameCtx.fillRect(0, 0, width, height);

    const videoSource = new CanvasSource(encoderCanvas, {
      codec: "avc",
      bitrate: computeVideoBitrate(width, height),
      keyFrameInterval: KEYFRAME_INTERVAL_SECONDS,
    });
    output.addVideoTrack(videoSource, { frameRate: EXPORT_FPS });

    let audioSource: AudioSampleSource | null = null;
    if (audio) {
      const nativeAac = await canEncodeAudio("aac", {
        numberOfChannels: audio.numberOfChannels,
        sampleRate: audio.sampleRate,
        bitrate: AUDIO_BITRATE,
      }).catch(() => false);
      if (!nativeAac && !aacEncoderRegistered) {
        registerAacEncoder();
        aacEncoderRegistered = true;
      }
      audioSource = new AudioSampleSource({ codec: "aac", bitrate: AUDIO_BITRATE });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    const frames = new VideoSampleSink(videoTrack);
    let framesDone = 0;
    const encodeFrame = async (outputFrame: number, sourceTime: number) => {
      ctx.drawImage(frameCanvas, 0, 0);
      renderAnnotations(ctx, width, height, project.annotations, sourceTime);
      await videoSource.add(outputFrame / EXPORT_FPS, 1 / EXPORT_FPS);
      framesDone++;
      if (framesDone % PROGRESS_EVERY_FRAMES === 0) {
        onProgress({ stage: "rendering", fraction: 0.05 + 0.9 * (framesDone / plan.totalFrames) });
      }
    };

    onProgress({ stage: "rendering", fraction: 0.05 });
    for (const segment of plan.segments) {
      throwIfAborted(signal);
      const outputStart = segment.outputStartFrame / EXPORT_FPS;

      if (segment.type === "video") {
        const times = Array.from({ length: segment.frameCount }, (_, k) => segment.start + k / EXPORT_FPS);
        let k = 0;
        for await (const { sample, changed } of framesAtTimes(frames, segment, times)) {
          throwIfAborted(signal);
          if (sample && changed) sample.draw(frameCtx, 0, 0, width, height);
          await encodeFrame(segment.outputStartFrame + k, times[k]);
          k++;
        }
        if (audioSource && audio) {
          await appendAudioRange(audioSource, audio, segment.start, segment.start + segment.frameCount / EXPORT_FPS, outputStart);
        }
      } else {
        const still = await frames.getSample(segment.time);
        if (still) {
          still.draw(frameCtx, 0, 0, width, height);
          still.close();
        }
        for (let k = 0; k < segment.frameCount; k++) {
          throwIfAborted(signal);
          await encodeFrame(segment.outputStartFrame + k, segment.time);
        }
        if (audioSource && audio) {
          await appendSilence(audioSource, audio, segment.frameCount / EXPORT_FPS, outputStart);
        }
      }
    }

    throwIfAborted(signal);
    onProgress({ stage: "finalizing", fraction: 0.95 });
    await output.finalize();

    const fileName = sanitizeExportFileName(project.title);
    const result = await sink.getFile(fileName);
    onProgress({ stage: "finalizing", fraction: 1 });

    return {
      file: result,
      fileName,
      durationSec: plan.totalFrames / EXPORT_FPS,
      sizeBytes: result.size,
      width,
      height,
      hasAudio: !!audio,
      audioPath: audio?.path,
      audioWarning: audioTrack && !audio ? "AUDIO_UNREADABLE" : undefined,
    };
  } catch (error) {
    const exportError = toExportError(error, { cancelled: signal.aborted, wasHidden });
    if (output && output.state !== "finalized" && output.state !== "canceled") {
      await output.cancel().catch(() => {});
    }
    await sink?.discard().catch(() => {});
    throw exportError;
  } finally {
    closeDecodedAudio(audio);
    input.dispose();
    await wakeLock?.release().catch(() => {});
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  }
}
```

- [ ] **Step 4: Create `src/export/deliverClip.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExportedClip } from "./exportClip";

export type DeliveryResult = "shared" | "downloaded" | "dismissed";

function download(file: File, fileName: string): DeliveryResult {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

// Must be called directly from a user gesture: iOS rejects share() without transient activation.
export async function deliverClip(
  clip: Pick<ExportedClip, "file" | "fileName">,
  mode: "share" | "download"
): Promise<DeliveryResult> {
  const shareFile = new File([clip.file], clip.fileName, { type: "video/mp4" });
  if (mode === "share" && navigator.canShare?.({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: clip.fileName });
      return "shared";
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "dismissed";
      throw error;
    }
  }
  return download(clip.file, clip.fileName);
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors and no new warnings in `src/export/`. If `tsc` rejects a Mediabunny type used above (for example `StreamTargetChunk` or the `iterator.next` value type), read `node_modules/mediabunny/dist/mediabunny.d.ts` for the exact name and fix the import; do not add `any`.

- [ ] **Step 6: Run all unit tests**

Run: `npm run test`
Expected: PASS (existing 42 + new tests from Tasks 2–7).

- [ ] **Step 7: Commit**

```bash
git add src/export/exportStorage.ts src/export/decodeClipAudio.ts src/export/exportClip.ts src/export/deliverClip.ts
git commit -m "feat(export): in-browser export orchestrator, audio fallback, storage and delivery

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Test fixtures

**Files:**
- Create: `scripts/generateExportFixtures.ts`
- Create (generated, committed): `e2e/fixtures/media/landscape-tone.mp4`, `e2e/fixtures/media/portrait-rotated-silent.mp4`, `e2e/fixtures/media/landscape-60fps-tone.mp4`

**Interfaces:**
- Produces: the three media files described below, used by Task 10.

| File | Content |
|---|---|
| `landscape-tone.mp4` | testsrc 640x360, 30 fps, 8 s, 440 Hz sine stereo 48 kHz AAC, H.264 yuv420p |
| `portrait-rotated-silent.mp4` | testsrc 640x360, 30 fps, 4 s, no audio, display rotation 90° (displays as 360x640) |
| `landscape-60fps-tone.mp4` | testsrc 640x360, 60 fps, 4 s, 440 Hz sine stereo 48 kHz AAC |

- [ ] **Step 1: Create the generator (spawn with argument arrays, per project rules)**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regenerates the small committed media fixtures for the browser export tests.
 * Requires ffmpeg and ffprobe on PATH. Not part of CI.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const outDir = path.resolve("e2e/fixtures/media");
fs.mkdirSync(outDir, { recursive: true });

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

const encodeArgs = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "30", "-movflags", "+faststart"];

function withTone(file: string, fps: number, seconds: number) {
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `testsrc=size=640x360:rate=${fps}:duration=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
    "-ac", "2", "-c:a", "aac", "-b:a", "96k", "-shortest",
    ...encodeArgs,
    path.join(outDir, file),
  ]);
}

withTone("landscape-tone.mp4", 30, 8);
withTone("landscape-60fps-tone.mp4", 60, 4);

const silentTmp = path.join(outDir, "_silent-landscape.mp4");
run("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=4",
  ...encodeArgs,
  silentTmp,
]);
run("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-display_rotation", "90", "-i", silentTmp,
  "-c", "copy", "-movflags", "+faststart",
  path.join(outDir, "portrait-rotated-silent.mp4"),
]);
fs.rmSync(silentTmp);

for (const file of fs.readdirSync(outDir).filter((f) => f.endsWith(".mp4"))) {
  const probe = run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:stream_side_data=rotation",
    "-of", "compact", path.join(outDir, file),
  ]);
  console.log(`${file} (${fs.statSync(path.join(outDir, file)).size} bytes)\n${probe}`);
}
```

- [ ] **Step 2: Generate the fixtures (PowerShell on Windows, where ffmpeg is on PATH)**

Run: `npx tsx scripts/generateExportFixtures.ts`
Expected output contains:
- `landscape-tone.mp4` with `codec_name=h264|width=640|height=360|r_frame_rate=30/1` and `codec_name=aac`
- `landscape-60fps-tone.mp4` with `r_frame_rate=60/1`
- `portrait-rotated-silent.mp4` with a video stream only and a `rotation=` side-data value of `90` or `-90`

If the portrait file shows no rotation side data, stop and report: the `-display_rotation` input option did not apply with stream copy on this FFmpeg build.

- [ ] **Step 3: Check total size**

Run: `du -ch e2e/fixtures/media/*.mp4 | tail -1`
Expected: under 1 MB total.

- [ ] **Step 4: Commit**

```bash
git add scripts/generateExportFixtures.ts e2e/fixtures/media
git commit -m "test: add small committed media fixtures for browser export tests

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Browser harness and engine tests in Chrome

**Files:**
- Create: `e2e/harness/export.html`, `e2e/harness/exportHarness.ts`, `e2e/engine/exportEngine.spec.ts`, `playwright.engine.config.ts`
- Modify: `playwright.config.ts` (ignore engine tests), `package.json` (scripts)

**Interfaces:**
- Consumes: `exportClip`, `ExportedClip`, `ExportError`, `listExportFiles`, `clearExportFiles`, `deliverClip`, `EXPORT_FPS`.
- Produces: `window.coachclipHarness` in the harness page:
  - `run(request: HarnessRunRequest): Promise<HarnessRunResult>`
  - `inspect(request: HarnessInspectRequest): Promise<HarnessInspection>`
  - `listExportFiles(): Promise<string[]>`
  - `download(): Promise<string>`
  - `clear(): Promise<void>`
- Produces: npm scripts `test:engine` and `verify:engine`.

- [ ] **Step 1: Create `e2e/harness/export.html`**

```html
<!doctype html>
<!-- Dev-only page used by e2e/engine tests. Not referenced by the app build. -->
<html lang="da">
  <head>
    <meta charset="utf-8" />
    <title>CoachClip export harness</title>
  </head>
  <body>
    <p id="status">loading</p>
    <script type="module" src="./exportHarness.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `e2e/harness/exportHarness.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ALL_FORMATS, AudioSampleSink, BlobSource, CanvasSink, Input } from "mediabunny";
import type { Annotation } from "../../shared/annotations";
import { exportClip, type ExportedClip } from "../../src/export/exportClip";
import { ExportError } from "../../src/export/exportErrors";
import { clearExportFiles, listExportFiles } from "../../src/export/exportStorage";
import { deliverClip } from "../../src/export/deliverClip";

export type HarnessRunRequest = {
  fixtureUrl: string;
  clip: { startTime: number; endTime: number };
  annotations: Annotation[];
  title?: string;
  forceWebAudio?: boolean;
  forceMemoryStorage?: boolean;
  abortAtFraction?: number;
  keepAs?: string;
};

export type HarnessRunResult = {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  clip?: Omit<ExportedClip, "file">;
  progressStages: string[];
};

export type HarnessInspectRequest = {
  name: string;
  compareWith?: string;
  audioWindows?: Array<[number, number]>;
  frameDiffs?: Array<[number, number]>;
  compareTimes?: number[];
};

export type HarnessInspection = {
  duration: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  frameCount: number;
  frameRate: number;
  audioPeaks: number[];
  frameDiffRatios: number[];
  compareDiffRatios: number[];
};

const kept = new Map<string, ExportedClip>();

async function openFrameSink(file: Blob) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("no video track");
  return { input, track, sink: new CanvasSink(track, { poolSize: 0 }) };
}

async function pixels(sink: CanvasSink, time: number): Promise<ImageData> {
  const wrapped = await sink.getCanvas(time);
  if (!wrapped) throw new Error(`no frame at ${time}`);
  const canvas = wrapped.canvas;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Fraction of pixels whose summed RGB difference exceeds 30.
function diffRatio(a: ImageData, b: ImageData): number {
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const delta = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (delta > 30) changed++;
  }
  return changed / (a.width * a.height);
}

async function run(request: HarnessRunRequest): Promise<HarnessRunResult> {
  const progressStages: string[] = [];
  const controller = new AbortController();
  const blob = await (await fetch(request.fixtureUrl)).blob();
  const file = new File([blob], request.fixtureUrl.split("/").pop() ?? "fixture.mp4", { type: "video/mp4" });
  try {
    const clip = await exportClip({
      file,
      project: { title: request.title ?? "Harness", clip: request.clip, annotations: request.annotations },
      signal: controller.signal,
      overrides: { forceWebAudio: request.forceWebAudio, forceMemoryStorage: request.forceMemoryStorage },
      onProgress: ({ stage, fraction }) => {
        if (progressStages[progressStages.length - 1] !== stage) progressStages.push(stage);
        if (request.abortAtFraction !== undefined && stage === "rendering" && fraction >= request.abortAtFraction) {
          controller.abort();
        }
      },
    });
    if (request.keepAs) kept.set(request.keepAs, clip);
    const summary: Partial<ExportedClip> = { ...clip };
    delete summary.file;
    return { ok: true, clip: summary as Omit<ExportedClip, "file">, progressStages };
  } catch (error) {
    const exportError = error instanceof ExportError ? error : null;
    return {
      ok: false,
      errorCode: exportError?.code ?? "NOT_AN_EXPORT_ERROR",
      errorMessage: exportError?.message ?? String(error),
      progressStages,
    };
  }
}

async function inspect(request: HarnessInspectRequest): Promise<HarnessInspection> {
  const clip = kept.get(request.name);
  if (!clip) throw new Error(`unknown export ${request.name}`);
  const main = await openFrameSink(clip.file);
  const stats = await main.track.computePacketStats();
  const audioTrack = await main.input.getPrimaryAudioTrack();

  const audioPeaks: number[] = [];
  for (const [from, to] of request.audioWindows ?? []) {
    let peak = 0;
    if (audioTrack) {
      for await (const sample of new AudioSampleSink(audioTrack).samples(from, to)) {
        const channel = new Float32Array(sample.numberOfFrames);
        sample.copyTo(channel, { planeIndex: 0, format: "f32-planar" });
        for (const value of channel) peak = Math.max(peak, Math.abs(value));
        sample.close();
      }
    }
    audioPeaks.push(peak);
  }

  const frameDiffRatios: number[] = [];
  for (const [t1, t2] of request.frameDiffs ?? []) {
    frameDiffRatios.push(diffRatio(await pixels(main.sink, t1), await pixels(main.sink, t2)));
  }

  const compareDiffRatios: number[] = [];
  if (request.compareWith) {
    const other = kept.get(request.compareWith);
    if (!other) throw new Error(`unknown export ${request.compareWith}`);
    const reference = await openFrameSink(other.file);
    for (const t of request.compareTimes ?? []) {
      compareDiffRatios.push(diffRatio(await pixels(main.sink, t), await pixels(reference.sink, t)));
    }
    reference.input.dispose();
  }

  const result: HarnessInspection = {
    duration: await main.input.computeDuration(),
    width: await main.track.getDisplayWidth(),
    height: await main.track.getDisplayHeight(),
    videoCodec: await main.track.getCodec(),
    audioCodec: audioTrack ? await audioTrack.getCodec() : null,
    frameCount: stats.packetCount,
    frameRate: stats.averagePacketRate,
    audioPeaks,
    frameDiffRatios,
    compareDiffRatios,
  };
  main.input.dispose();
  return result;
}

async function download(): Promise<string> {
  const clip = [...kept.values()].pop();
  if (!clip) throw new Error("nothing exported");
  return deliverClip(clip, "download");
}

const harness = { run, inspect, listExportFiles, clearExportFiles, download };
declare global {
  interface Window {
    coachclipHarness: typeof harness;
  }
}
window.coachclipHarness = harness;
document.getElementById("status")!.textContent = "ready";
```

- [ ] **Step 3: Create `playwright.engine.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:3002";

// Runs the browser export engine tests in Google Chrome (Playwright's bundled Chromium lacks H.264/AAC).
export default defineConfig({
  testDir: "./e2e/engine",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: ORIGIN,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 3002 --strictPort",
    url: `${ORIGIN}/e2e/harness/export.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
```

- [ ] **Step 4: Keep the existing E2E config away from engine tests**

In `playwright.config.ts`, add `testIgnore: ["engine/**"],` directly below `testDir: "./e2e",`.

- [ ] **Step 5: Add npm scripts**

In `package.json` `scripts`, add:

```json
"test:engine": "playwright test -c playwright.engine.config.ts",
"verify:engine": "npm run test:engine",
```

and change `verify` to:

```json
"verify": "npm run verify:lint && npm run verify:typecheck && npm run verify:unit && npm run verify:build && npm run verify:engine && npm run verify:smoke && npm run verify:e2e"
```

- [ ] **Step 6: Write the engine tests**

Create `e2e/engine/exportEngine.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";
import type { Annotation } from "../../shared/annotations";
import type { HarnessInspectRequest, HarnessRunRequest } from "../harness/exportHarness";

const LANDSCAPE = "/e2e/fixtures/media/landscape-tone.mp4";
const PORTRAIT = "/e2e/fixtures/media/portrait-rotated-silent.mp4";
const SIXTY_FPS = "/e2e/fixtures/media/landscape-60fps-tone.mp4";

const clip = { startTime: 1, endTime: 5 };
const freeze: Annotation = { id: "f", type: "freeze", time: 3, duration: 2 };
const drawings: Annotation[] = [
  { id: "t", type: "text", startTime: 2, endTime: 4, text: "Kom tidligere ind – æøå", x: 0.5, y: 0.2, size: "large" },
  { id: "c", type: "circle", startTime: 2, endTime: 4, x: 0.3, y: 0.6, radius: 0.2, color: "yellow", thickness: "bold" },
  { id: "a", type: "arrow", startTime: 2, endTime: 4, startX: 0.55, startY: 0.3, endX: 0.85, endY: 0.8, color: "red" },
];

async function openHarness(page: Page) {
  await page.goto("/e2e/harness/export.html");
  await expect(page.locator("#status")).toHaveText("ready");
  await page.evaluate(() => window.coachclipHarness.clearExportFiles());
}

const run = (page: Page, request: HarnessRunRequest) => page.evaluate((r) => window.coachclipHarness.run(r), request);
const inspect = (page: Page, request: HarnessInspectRequest) => page.evaluate((r) => window.coachclipHarness.inspect(r), request);

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test("exports landscape clip with freeze, annotations and audio", async ({ page }) => {
  const annotated = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [freeze, ...drawings], keepAs: "annotated", title: "Pres på midten" });
  expect(annotated.ok, annotated.errorMessage).toBe(true);
  expect(annotated.clip).toMatchObject({ width: 640, height: 360, hasAudio: true, durationSec: 6, fileName: "Pres_paa_midten.mp4" });
  expect(annotated.progressStages).toEqual(["preparing", "decoding_audio", "rendering", "finalizing"]);

  const reference = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [freeze], keepAs: "reference" });
  expect(reference.ok, reference.errorMessage).toBe(true);

  // Output timeline: 0–2 video (source 1–3), 2–4 freeze at source 3, 4–6 video (source 3–5).
  const result = await inspect(page, {
    name: "annotated",
    audioWindows: [[0.2, 1.8], [2.2, 3.8], [4.2, 5.8]],
    frameDiffs: [[2.3, 3.7]],
    compareWith: "reference",
    // 5.5 s is not compared: it shares a 2 s keyframe group with annotated frames, so encoder residuals may differ.
    compareTimes: [0.5, 1.5, 3.0],
  });

  expect(result.duration).toBeGreaterThan(5.95);
  expect(result.duration).toBeLessThan(6.1);
  expect(result).toMatchObject({ width: 640, height: 360, videoCodec: "avc", audioCodec: "aac", frameCount: 180 });
  expect(result.frameRate).toBeCloseTo(30, 0);

  const [before, during, after] = result.audioPeaks;
  expect(before).toBeGreaterThan(0.05);
  expect(during).toBeLessThan(0.001);
  expect(after).toBeGreaterThan(0.05);

  expect(result.frameDiffRatios[0]).toBe(0);

  const [outside, activeVideo, activeFreeze] = result.compareDiffRatios;
  expect(outside).toBeLessThan(0.005);
  expect(activeVideo).toBeGreaterThan(0.02);
  expect(activeFreeze).toBeGreaterThan(0.02);
});

test("keeps rotated portrait video portrait and exports without audio", async ({ page }) => {
  const result = await run(page, { fixtureUrl: PORTRAIT, clip: { startTime: 0, endTime: 3 }, annotations: drawings, keepAs: "portrait" });
  expect(result.ok, result.errorMessage).toBe(true);
  expect(result.clip).toMatchObject({ width: 360, height: 640, hasAudio: false });
  expect(result.clip?.audioWarning).toBeUndefined();

  const inspection = await inspect(page, { name: "portrait" });
  expect(inspection).toMatchObject({ width: 360, height: 640, audioCodec: null, frameCount: 90 });
});

test("normalizes 60 fps source to 30 fps output", async ({ page }) => {
  const result = await run(page, { fixtureUrl: SIXTY_FPS, clip: { startTime: 0, endTime: 4 }, annotations: [], keepAs: "sixty" });
  expect(result.ok, result.errorMessage).toBe(true);
  const inspection = await inspect(page, { name: "sixty" });
  expect(inspection.frameCount).toBe(120);
  expect(inspection.frameRate).toBeCloseTo(30, 0);
});

test("Web Audio fallback keeps audio and silence during freeze", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [freeze], forceWebAudio: true, keepAs: "webaudio" });
  expect(result.ok, result.errorMessage).toBe(true);
  expect(result.clip).toMatchObject({ hasAudio: true, audioPath: "webaudio" });
  const inspection = await inspect(page, { name: "webaudio", audioWindows: [[0.2, 1.8], [2.2, 3.8], [4.2, 5.8]] });
  expect(inspection.audioPeaks[0]).toBeGreaterThan(0.05);
  expect(inspection.audioPeaks[1]).toBeLessThan(0.001);
  expect(inspection.audioPeaks[2]).toBeGreaterThan(0.05);
});

test("in-memory storage fallback produces the same clip", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [freeze], forceMemoryStorage: true, keepAs: "memory" });
  expect(result.ok, result.errorMessage).toBe(true);
  const inspection = await inspect(page, { name: "memory" });
  expect(inspection.frameCount).toBe(180);
  expect(await page.evaluate(() => window.coachclipHarness.listExportFiles())).toEqual([]);
});

test("cancelling rejects with CANCELLED and removes the partial file", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [freeze, ...drawings], abortAtFraction: 0.3 });
  expect(result.ok).toBe(false);
  expect(result.errorCode).toBe("CANCELLED");
  expect(result.errorMessage).toBe("Eksporten blev afbrudt.");
  expect(await page.evaluate(() => window.coachclipHarness.listExportFiles())).toEqual([]);
});

test("rejects an invalid project with the Danish validation message", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip: { startTime: 1, endTime: 1.2 }, annotations: [] });
  expect(result).toMatchObject({
    ok: false,
    errorCode: "INVALID_PROJECT",
    errorMessage: "Det valgte klip skal være mindst 0,5 sekunder.",
  });
});

test("download delivers an mp4 with the sanitized file name", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [], title: "Træning Åen", keepAs: "download" });
  expect(result.ok, result.errorMessage).toBe(true);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => window.coachclipHarness.download()),
  ]);
  expect(download.suggestedFilename()).toBe("Traening_Aaen.mp4");
});
```

- [ ] **Step 7: Run the engine tests**

Run: `npm run test:engine`
Expected: 8 passed. Things to check if it fails, in order:
1. `#status` never becomes `ready`: open `http://127.0.0.1:3002/e2e/harness/export.html` in Chrome, read the console. A Vite dependency-optimizer error for `@mediabunny/aac-encoder` (it contains `import("worker_threads")` for Node) is fixed by adding `optimizeDeps: { exclude: ["@mediabunny/aac-encoder"] }` to `vite.config.ts`.
2. `UNSUPPORTED_BROWSER`: Playwright is not using Google Chrome; confirm `channel: "chrome"` and that Chrome is installed.
3. Pixel-ratio thresholds: log `result.compareDiffRatios` and report the numbers before changing any threshold. The annotated and reference exports use the same encoder settings, so frames outside the annotation window should differ by well under 0.5 %.

- [ ] **Step 8: Run the full local gate**

Run: `npm run verify:lint && npm run verify:typecheck && npm run verify:unit && npm run verify:build && npm run verify:engine`
Expected: all green. Confirm `dist/` contains no `e2e/harness` files: `ls dist | grep -c harness` prints `0`.

- [ ] **Step 9: Commit**

```bash
git add e2e/harness e2e/engine playwright.engine.config.ts playwright.config.ts package.json vite.config.ts
git commit -m "test(export): run the export engine in Chrome against committed fixtures

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(`vite.config.ts` is only staged if Step 7 needed the `optimizeDeps` change.)

---

### Task 11: CI and pull request

**Files:**
- Modify: `.github/workflows/verify.yml`

**Interfaces:**
- Consumes: `npm run verify` from Task 10.

- [ ] **Step 1: Install Google Chrome in the verify job**

In `.github/workflows/verify.yml`, job `verify`, replace the step

```yaml
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium
```

with

```yaml
      - name: Install Playwright Chromium and Google Chrome
        run: npx playwright install --with-deps chromium chrome
```

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/browser-export-engine
gh pr create --base main --title "feat: in-browser export engine (no UI change yet)" --body-file - <<'EOF'
## Summary
Implements PR B from `docs/superpowers/specs/2026-09-13-browser-export-design.md`: a self-contained export engine in `src/export/` that produces the MP4 in the browser with Mediabunny 1.56.2 (WebCodecs). The UI and server are unchanged; PR C switches the UI over and removes the server.

- `shared/`: orientation-preserving output dimensions + bitrate, validation rules moved from the server route, canvas annotation geometry (scale from short side, measured text width, arrow head)
- `src/export/`: segment planning, canvas annotation rendering, error codes with Danish messages, capability detection, OPFS/in-memory storage, audio decoding with Web Audio fallback, `exportClip`, `deliverClip`
- Browser tests in Google Chrome against committed fixtures: duration, dimensions, 30 fps, audio vs. silence during freeze, identical freeze frames, annotation windows, portrait rotation, 60→30 fps, Web Audio fallback, memory fallback, cancel cleanup, validation, download

Includes the design spec and this implementation plan.

## Test plan
- [ ] `npm run verify:unit`
- [ ] `npm run verify:engine` locally (Windows, Chrome)
- [ ] CI green, including engine tests in Chrome on Linux (first run confirms H.264 encoding in CI Chrome)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 3: Watch CI**

Use the ccd_pr tools to read CI status. If the engine tests fail in CI only with `UNSUPPORTED_BROWSER`, Chrome on the runner cannot encode H.264: report this with the log excerpt instead of weakening the tests.

---

## Self-Review Notes

- **Spec coverage (PR B scope):** 5.1 interface → Task 8 (`exportClip`, `ExportedClip`, stages + Danish labels). 5.2 validation → Task 3. 5.3 timeline → Task 4. 5.4 dimensions/bitrate → Task 2. 5.5 drawing → Tasks 5–6. 5.6 flow → Task 8. 5.7 storage/cleanup → Task 8 (`createExportSink`, `discard`, `clearExportFiles`; calling `clearExportFiles` at app start and on leaving the success screen is UI work in PR C). 5.8 cancel/wake lock/visibility → Task 8. 7 error codes → Task 7. 8.1 unit tests → Tasks 2–7. 8.2 browser tests → Tasks 9–10. 8.4 CI → Task 11. Sections 6, 8.3 (UI E2E), 9 and 10.3–10.4 belong to the PR C and D plans.
- **Additions beyond the spec:** `INVALID_PROJECT` error code, `ExportedClip.audioPath`, `ExportClipOptions.overrides` (test-only). All are listed in the tasks where they appear.
- **Known risks to watch during execution:** Vite optimizing `@mediabunny/aac-encoder` (Task 10 Step 7), `-display_rotation` with stream copy (Task 9 Step 2), H.264 in CI Chrome (Task 11 Step 3).
