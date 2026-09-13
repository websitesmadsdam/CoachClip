# Browser Export UI Switch Implementation Plan (PR C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CoachClip exports clips entirely in the browser through the engine from PR #5, draws annotations with one shared canvas renderer everywhere, and no longer contains a server, Docker or FFmpeg runtime.

**Architecture:** The export screen calls `exportClip` from `src/export/` and the success screen delivers the resulting file with `deliverClip`. Every place that previews annotations uses a new `AnnotationCanvas` component that calls the same `renderAnnotations` as the export, while the editor keeps DOM elements only as invisible drag handles. The app is a static Vite build; E2E tests run that build in Google Chrome under the production security headers defined in `vercel.json`.

**Tech Stack:** React 19, Vite 6, Tailwind 4, TypeScript 5.8, Mediabunny 1.56.2, vitest 4, Playwright 1.61 (`channel: "chrome"`).

**Spec:** `docs/superpowers/specs/2026-09-13-browser-export-design.md` (sections 4, 6, 7, 8, 9, 10.3). Carry-over items from PR #5 reviews are listed in "Carry-over coverage" at the end.

## Global Constraints

- All user-facing text is Danish, written for a sports coach. Code, comments and commit messages are English.
- No code may call `/api/...` or depend on a server. After Task 5 nothing under `server/` exists.
- Annotations are drawn only through `renderAnnotations` (`src/export/renderAnnotations.ts`). No component may draw arrows, circles or text boxes with its own SVG/CSS styling.
- Coordinates in the data model are relative 0–1. Times are absolute source-video seconds.
- Types come from `shared/` (`shared/annotations.ts`) or are frontend-only models in `src/types.ts`.
- `tsconfig.json` has no `strict`: do not narrow unions by a boolean discriminant. New code uses no `any` and no `@ts-ignore`.
- OPFS export files (`coachclip-export-*`) are cleared at app start, when a new export starts, and when the user leaves the success screen.
- Supported export targets: iPhone/iPad iOS 26+, and Chrome/Edge/Safari on desktop. The engine does not sniff user agents.
- Mediabunny stays pinned at exactly `1.56.2` (`mediabunny`, `@mediabunny/aac-encoder`).
- The production Content-Security-Policy (Task 4) allows no inline or external scripts.
- `npm run test:engine` and `npm run test:e2e` require Google Chrome installed (`C:\Program Files\Google\Chrome\Application\chrome.exe` on the dev machine).
- Every commit message ends with exactly `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Work happens on branch `feat/browser-export-ui` (already created from `main` at 7aad7e8, contains this plan).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/export/renderAnnotations.ts` | modify | export `annotationFont` |
| `src/export/exportClip.ts` | modify | dynamic AAC import, wake-lock re-acquire, skip audio outside the track |
| `src/export/decodeClipAudio.ts` | modify | empty WebCodecs result falls back to Web Audio |
| `src/export/deliverClip.ts` | modify | non-abort share errors fall back to download |
| `e2e/harness/exportHarness.ts`, `e2e/engine/exportEngine.spec.ts` | modify | share fallback test |
| `src/types.ts` | modify | `ExportStatus`, `ProjectExport` without server fields |
| `src/utils/projectStatus.ts` (+ test) | create | `isProjectExported`, `hasMatchingSource` |
| `src/components/ExportScreen.tsx` | rewrite | run `exportClip`, progress, cancel, errors, unsupported browser |
| `src/App.tsx` | modify | export success, delivery, restore/preview intent, OPFS cleanup, review canvas |
| `src/screens/ProjectLibraryScreen.tsx`, `src/screens/HomeScreen.tsx` | modify | exported badge without expiry |
| `src/components/CollectionsScreen.tsx` | modify | remove fake playlist player |
| `src/features/annotations/AnnotationCanvas.tsx` | create | canvas overlay over a contain-fitted video |
| `src/features/annotations/measureAnnotationText.ts` | create | canvas text measurement for DOM hit areas |
| `src/features/annotations/AnnotationEditor.tsx` | modify | canvas preview, real video size, freeze badge |
| `src/features/annotations/*/…AnnotationView.tsx` | modify | invisible drag handles only |
| `src/screens/PreviewScreen.tsx` | modify | canvas preview |
| `vercel.json` | create | build settings and security headers |
| `vite.config.ts` | modify | preview serves `vercel.json` headers, remove AI Studio HMR logic |
| `playwright.config.ts` | rewrite | built app in Chrome |
| `e2e/fixtures/testVideo.ts`, `e2e/fixtures/appFlow.ts` | rewrite/create | shared UI flow helpers |
| `e2e/export-flow.spec.ts`, `e2e/cancel-export.spec.ts` | rewrite | browser export through the UI |
| `e2e/api-contract.spec.ts`, `e2e/cors.spec.ts`, `e2e/export-expiry.spec.ts`, `e2e/sw-cache.spec.ts`, `scripts/generateE2EVideo.ts` | delete | server-only tests |
| `server/`, `server.ts`, `Dockerfile`, `.dockerignore`, `scripts/smoke*.ts`, `shared/exportJob.ts`, `metadata.json`, `.env.example`, `public/sw.js`, `src/components/EditorScreen.tsx`, `src/components/TrimScreen.tsx`, `src/hooks/useAutosave.ts` | delete | server and dead code |
| `shared/exportSchema.ts` (+ test), `shared/annotationGeometry.ts` (+ test) | modify | drop server types and legacy geometry |
| `package.json`, `package-lock.json` | modify | name, scripts, dependencies |
| `src/main.tsx`, `src/components/UserGuide.tsx` | modify | unregister service worker, texts |
| `.github/workflows/verify.yml`, `CLAUDE.md`, `README.md` | rewrite | CI and docs |

---

### Task 1: Engine polish carried over from PR #5

**Files:**
- Modify: `src/export/renderAnnotations.ts`, `src/export/renderAnnotations.test.ts`
- Modify: `src/export/exportClip.ts`
- Modify: `src/export/decodeClipAudio.ts`
- Modify: `src/export/deliverClip.ts`
- Modify: `e2e/harness/exportHarness.ts`, `e2e/engine/exportEngine.spec.ts`

**Interfaces:**
- Produces: `annotationFont(fontSize: number): string` from `src/export/renderAnnotations.ts` (used by Task 3).
- Produces: `deliverClip` never rejects for a failed share sheet; it returns `"downloaded"` instead (used by Task 2).
- Produces: harness method `window.coachclipHarness.share(): Promise<string>`.

- [ ] **Step 1: Write the failing unit test for `annotationFont`**

In `src/export/renderAnnotations.test.ts`, change the import line to:

```ts
import { renderAnnotations, isAnnotationActive, annotationFont, type AnnotationContext2D } from "./renderAnnotations";
```

and add at the end of the file:

```ts
describe("annotationFont", () => {
  it("matches the font the export canvas draws with", () => {
    expect(annotationFont(40)).toBe("bold 40px Arial, Helvetica, sans-serif");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/export/renderAnnotations.test.ts`
Expected: FAIL (`annotationFont` is not exported).

- [ ] **Step 3: Export `annotationFont`**

In `src/export/renderAnnotations.ts`, replace

```ts
const fontFor = (fontSize: number) => `${ANNOTATION_STYLE.fontWeight} ${fontSize}px ${ANNOTATION_STYLE.fontFamily}`;
```

with

```ts
export function annotationFont(fontSize: number): string {
  return `${ANNOTATION_STYLE.fontWeight} ${fontSize}px ${ANNOTATION_STYLE.fontFamily}`;
}
```

and replace both uses of `fontFor(` in the same file with `annotationFont(`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/export/renderAnnotations.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Share failures fall back to download**

In `src/export/deliverClip.ts`, replace

```ts
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "dismissed";
      throw error;
    }
```

with

```ts
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "dismissed";
      // For example NotAllowedError when the user gesture expired: the coach still gets the file.
      console.warn("Sharing the clip failed, downloading instead:", error);
    }
```

- [ ] **Step 6: Expose `share()` in the harness**

In `e2e/harness/exportHarness.ts`, replace

```ts
async function download(): Promise<string> {
  const clip = [...kept.values()].pop();
  if (!clip) throw new Error("nothing exported");
  return deliverClip(clip, "download");
}

const harness = { run, inspect, listExportFiles, clearExportFiles, download };
```

with

```ts
function lastKeptClip(): ExportedClip {
  const clip = [...kept.values()].pop();
  if (!clip) throw new Error("nothing exported");
  return clip;
}

async function download(): Promise<string> {
  return deliverClip(lastKeptClip(), "download");
}

async function share(): Promise<string> {
  return deliverClip(lastKeptClip(), "share");
}

const harness = { run, inspect, listExportFiles, clearExportFiles, download, share };
```

- [ ] **Step 7: Add the engine test**

Append to `e2e/engine/exportEngine.spec.ts`:

```ts
test("share falls back to download when the share sheet is not allowed", async ({ page }) => {
  const result = await run(page, { fixtureUrl: LANDSCAPE, clip, annotations: [], title: "Del mig", keepAs: "share" });
  expect(result.ok, result.errorMessage).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      value: () => Promise.reject(new DOMException("User gesture expired", "NotAllowedError")),
      configurable: true,
    });
  });
  const [download, delivery] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => window.coachclipHarness.share()),
  ]);
  expect(delivery).toBe("downloaded");
  expect(download.suggestedFilename()).toBe("Del_mig.mp4");
});
```

- [ ] **Step 8: Empty WebCodecs audio falls back to Web Audio**

In `src/export/decodeClipAudio.ts`, inside `decodeWithWebCodecs`, replace

```ts
  return toDecodedAudio(samples, "webcodecs");
}
```

with

```ts
  // A decoder that silently yields nothing gets the same second chance as one that throws.
  if (samples.length === 0) throw new Error("WebCodecs produced no audio samples");
  return toDecodedAudio(samples, "webcodecs");
}
```

- [ ] **Step 9: Load the AAC encoder only when needed, re-acquire the wake lock, skip audio that ends before the clip**

In `src/export/exportClip.ts`:

1. Delete the line `import { registerAacEncoder } from "@mediabunny/aac-encoder";`.

2. Replace

```ts
  let wasHidden = typeof document !== "undefined" && document.hidden;
  const onVisibility = () => {
    if (document.hidden) wasHidden = true;
  };
```

with

```ts
  let wasHidden = typeof document !== "undefined" && document.hidden;
  let finished = false;
  const onVisibility = () => {
    if (document.hidden) {
      wasHidden = true;
      return;
    }
    // Browsers release the wake lock while the page is hidden; ask again when the coach returns.
    if (wakeLock?.released && navigator.wakeLock) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (finished) void lock.release();
          else wakeLock = lock;
        })
        .catch(() => {});
    }
  };
```

3. Replace

```ts
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack) {
```

with

```ts
    const audioTrack = await input.getPrimaryAudioTrack();
    // An audio track that ends before the clip starts means "no audio here", not "unreadable audio".
    // If the track duration cannot be computed, assume it covers the clip and let decoding decide.
    const audioCoversClip = audioTrack
      ? (await audioTrack.computeDuration().catch(() => Number.POSITIVE_INFINITY)) > project.clip.startTime
      : false;
    if (audioTrack && audioCoversClip) {
```

4. Replace

```ts
      if (!nativeAac && !aacEncoderRegistered) {
        registerAacEncoder();
        aacEncoderRegistered = true;
      }
```

with

```ts
      if (!nativeAac && !aacEncoderRegistered) {
        // Loaded on demand: the wasm encoder is large and iPhones (iOS 26+) encode AAC natively.
        const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
        registerAacEncoder();
        aacEncoderRegistered = true;
      }
```

5. Replace

```ts
      audioWarning: audioTrack && !audio ? "AUDIO_UNREADABLE" : undefined,
```

with

```ts
      audioWarning: audioTrack && audioCoversClip && !audio ? "AUDIO_UNREADABLE" : undefined,
```

6. In the `finally` block, replace

```ts
  } finally {
    closeDecodedAudio(audio);
```

with

```ts
  } finally {
    finished = true;
    closeDecodedAudio(audio);
```

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:engine`
Expected: typecheck and lint clean, unit tests pass, engine tests 10 passed (9 existing + share fallback). If Vite fails to optimize the dynamic `@mediabunny/aac-encoder` import in the engine run, add `optimizeDeps: { exclude: ["@mediabunny/aac-encoder"] }` to the object returned by `vite.config.ts` and re-run.

- [ ] **Step 11: Commit**

```bash
git add src/export e2e/harness/exportHarness.ts e2e/engine/exportEngine.spec.ts vite.config.ts
git commit -m "feat(export): share fallback, on-demand AAC encoder, wake lock and audio edge cases

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(`vite.config.ts` is only staged if Step 10 needed the `optimizeDeps` change.)

---

### Task 2: Switch the export flow in the UI to `exportClip`

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/projectStatus.ts`, `src/utils/projectStatus.test.ts`
- Rewrite: `src/components/ExportScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/screens/ProjectLibraryScreen.tsx`, `src/screens/HomeScreen.tsx`
- Modify: `src/components/CollectionsScreen.tsx`

**Interfaces:**
- Consumes (Task 1 / PR #5): `exportClip`, `EXPORT_STAGE_LABELS`, `type ExportedClip`, `type ExportProgress` from `src/export/exportClip.ts`; `ExportError`, `EXPORT_ERROR_MESSAGES`, `AUDIO_WARNING_MESSAGE` from `src/export/exportErrors.ts`; `detectExportCapabilities` from `src/export/capabilities.ts`; `clearExportFiles` from `src/export/exportStorage.ts`; `deliverClip` from `src/export/deliverClip.ts`.
- Produces:
  - `type ExportStatus = "not_exported" | "exported"` and `type ProjectExport` in `src/types.ts`
  - `isProjectExported(project): boolean`, `hasMatchingSource(file: File | null, project): boolean` in `src/utils/projectStatus.ts`
  - `ExportScreen` props: `{ project: CoachClipProject; sourceFile: File | null; onExportSuccess: (clip: ExportedClip) => void; onExportFailed: (errorMsg?: string) => void }`

**Product decision recorded here:** the Collections "Afspil samling" player is removed. It played a stock basketball video from an external site whenever a project had no server export URL, never the coach's own clip, and the production CSP would block that video anyway. Collections keep creating, ordering and removing clips.

- [ ] **Step 1: Write the failing test for the project status helpers**

Create `src/utils/projectStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/projectStatus.test.ts`
Expected: FAIL (cannot resolve `./projectStatus`).

- [ ] **Step 3: Update the project types**

In `src/types.ts`, replace everything from the comment line that starts with `// Persisted project export state (IndexedDB).` through the end of the `CoachClipProject` type (the line `};` after the `export?: { … };` block) with:

```ts
// Persisted per project in IndexedDB. Projects saved by older versions can still contain server-era
// fields (exportedVideoUrl, export.jobId/downloadUrl/expiresAt, other statuses); they are ignored.
export type ExportStatus = "not_exported" | "exported";

export type ProjectExport = {
  status: "exported";
  fileName: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  exportedAt: string;
};

export type CoachClipProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceVideo: {
    fileName: string;
    duration: number; // in seconds
    size: number; // in bytes
    width?: number;
    height?: number;
  };
  clip: {
    startTime: number;
    endTime: number;
  };
  annotations: Annotation[];
  category?: string;
  feedbackType?: "positive" | "development";
  collectionId?: string;
  exportStatus?: ExportStatus;
  export?: ProjectExport;
};
```

- [ ] **Step 4: Create the helpers**

Create `src/utils/projectStatus.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoachClipProject } from "../types";

// Only an explicit "exported" counts; older versions also stored server states like "expired".
export function isProjectExported(project: Pick<CoachClipProject, "exportStatus" | "export">): boolean {
  return project.export?.status === "exported" || project.exportStatus === "exported";
}

// Source videos are never stored, so a project can only be opened with the same file picked again.
export function hasMatchingSource(file: File | null, project: Pick<CoachClipProject, "sourceVideo">): boolean {
  return !!file && file.name === project.sourceVideo.fileName && file.size === project.sourceVideo.size;
}
```

- [ ] **Step 5: Run the helper tests**

Run: `npx vitest run src/utils/projectStatus.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Rewrite `ExportScreen.tsx`**

Replace the whole file `src/components/ExportScreen.tsx` with:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { CoachClipProject } from "../types";
import { exportClip, EXPORT_STAGE_LABELS, type ExportedClip, type ExportProgress } from "../export/exportClip";
import { ExportError, EXPORT_ERROR_MESSAGES } from "../export/exportErrors";
import { detectExportCapabilities } from "../export/capabilities";
import { clearExportFiles } from "../export/exportStorage";

const MISSING_SOURCE_MESSAGE = "Kildevideoen blev ikke fundet. Vælg eller genforbind din videofil for at eksportere.";
const CANCELLED_BY_USER = "Afbrudt af bruger.";

type ScreenState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "running"; progress: ExportProgress }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" };

interface ExportScreenProps {
  project: CoachClipProject;
  sourceFile: File | null;
  onExportSuccess: (clip: ExportedClip) => void;
  onExportFailed: (errorMsg?: string) => void;
}

function stageText(progress: ExportProgress): string {
  const label = EXPORT_STAGE_LABELS[progress.stage];
  return progress.stage === "rendering" ? `${label} ${Math.round(progress.fraction * 100)} %` : label;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({ project, sourceFile, onExportSuccess, onExportFailed }) => {
  const [state, setState] = useState<ScreenState>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    let active = true;
    const update = (next: ScreenState) => {
      if (active) setState(next);
    };

    (async () => {
      if (!sourceFile || sourceFile.size === 0) {
        update({ kind: "failed", message: MISSING_SOURCE_MESSAGE });
        return;
      }
      update({ kind: "checking" });
      const capabilities = await detectExportCapabilities();
      if (!active) return;
      if (!capabilities.supported) {
        update({ kind: "unsupported" });
        return;
      }
      // The coach may already have pressed "Afbryd eksport" while the browser was being checked
      if (controller.signal.aborted) {
        update({ kind: "cancelled" });
        return;
      }
      update({ kind: "running", progress: { stage: "preparing", fraction: 0 } });
      await clearExportFiles();
      try {
        const clip = await exportClip({
          file: sourceFile,
          project,
          signal: controller.signal,
          onProgress: (progress) => update({ kind: "running", progress }),
        });
        if (active) onExportSuccess(clip);
      } catch (error) {
        const exportError = error instanceof ExportError ? error : new ExportError("UNKNOWN", { cause: error });
        update(exportError.code === "CANCELLED" ? { kind: "cancelled" } : { kind: "failed", message: exportError.message });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
    // The project and source file are fixed while this screen is shown; "Prøv igen" bumps `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.kind === "unsupported") {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-scale-up">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Browseren kan ikke lave klip</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">{EXPORT_ERROR_MESSAGES.UNSUPPORTED_BROWSER}</p>
        <button
          onClick={() => onExportFailed(CANCELLED_BY_USER)}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
        >
          Gå tilbage
        </button>
      </div>
    );
  }

  if (state.kind === "failed" || state.kind === "cancelled") {
    const isCancelled = state.kind === "cancelled";
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-scale-up">
        {isCancelled ? (
          <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <X className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
        )}
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">
          {isCancelled ? "Eksporten blev afbrudt" : "Eksporten fejlede"}
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
          {state.kind === "cancelled" ? "Du afbrød eksporten. Projektet og dine markeringer er stadig gemt." : state.message}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => onExportFailed(state.kind === "cancelled" ? CANCELLED_BY_USER : state.message)}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Gå tilbage
          </button>
          <button
            onClick={() => setAttempt((value) => value + 1)}
            className="flex-1 py-3 bg-brand-clear hover:bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  const progress = state.kind === "running" ? state.progress : null;
  const percent = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center animate-scale-up">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-16 h-16 text-brand-clear animate-spin" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-slate-700">
          {percent}%
        </div>
      </div>

      <h3 className="text-lg font-black text-brand-dark mb-1 text-center">Opretter dit taktikklip</h3>

      <p className="text-xs text-brand-clear font-bold tracking-wider uppercase mb-8 text-center animate-pulse">
        {progress ? stageText(progress) : EXPORT_STAGE_LABELS.preparing}
      </p>

      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-brand-clear transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <p className="text-[10px] text-slate-400 font-medium text-center mb-6 leading-relaxed max-w-xs">
        Klippet laves på din enhed – videoen sendes ingen steder. Hold skærmen tændt, til klippet er færdigt.
      </p>

      <button
        onClick={() => controllerRef.current?.abort()}
        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
      >
        <X className="w-3.5 h-3.5" />
        <span>Afbryd eksport</span>
      </button>
    </div>
  );
};
```

- [ ] **Step 7: Update `App.tsx` imports and state**

1. After the line `import { useObjectUrl } from "./hooks/useObjectUrl";` add:

```tsx
import type { ExportedClip } from "./export/exportClip";
import { deliverClip } from "./export/deliverClip";
import { clearExportFiles } from "./export/exportStorage";
import { AUDIO_WARNING_MESSAGE } from "./export/exportErrors";
import { hasMatchingSource } from "./utils/projectStatus";
```

2. After the line `const [previewCurrentTime, setPreviewCurrentTime] = useState(0);` add:

```tsx
  // The finished clip lives only in memory/OPFS while the success screen is shown
  const [exportedClip, setExportedClip] = useState<ExportedClip | null>(null);
  const [restoreIntent, setRestoreIntent] = useState<"edit" | "preview">("edit");
  const previousStepRef = useRef(editorStep);

  // Leftover export files from an earlier visit are never needed again
  useEffect(() => {
    void clearExportFiles();
  }, []);

  // Leaving the success screen discards the clip file; a new export creates a fresh one
  useEffect(() => {
    if (previousStepRef.current === "success" && editorStep !== "success") {
      setExportedClip(null);
      void clearExportFiles();
    }
    previousStepRef.current = editorStep;
  }, [editorStep]);
```

- [ ] **Step 8: Restore, edit and preview use the source file**

1. Replace the whole `handleRestoreVideoFile` function with:

```tsx
  // Restoring a project: videos are never stored, so the coach picks the source file again
  const handleRestoreVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !projectToRestore) return;
    setSelectedFile(file);
    setVideoDuration(projectToRestore.sourceVideo.duration);
    setProjectToRestore(null);
    if (restoreIntent === "preview") {
      setPreviewProject(projectToRestore);
      setPreviewCurrentTime(projectToRestore.clip.startTime);
      return;
    }
    setTrimRange(projectToRestore.clip);
    setAnnotations(projectToRestore.annotations);
    setActiveProject(projectToRestore);
    setEditorStep("editor");
  };
```

2. Replace the whole `selectProjectForEditing` function with:

```tsx
  const selectProjectForEditing = (proj: CoachClipProject) => {
    // Reuse the file picked in this session when it is the project's source; otherwise ask for it
    if (!hasMatchingSource(selectedFile, proj)) {
      setRestoreIntent("edit");
      setProjectToRestore(proj);
      return;
    }
    setVideoDuration(proj.sourceVideo.duration);
    setTrimRange(proj.clip);
    setAnnotations(proj.annotations);
    setActiveProject(proj);
    setEditorStep("editor");
  };
```

3. Replace the whole `openPreview` function with:

```tsx
  const openPreview = (proj: CoachClipProject) => {
    if (!hasMatchingSource(selectedFile, proj)) {
      setRestoreIntent("preview");
      setProjectToRestore(proj);
      return;
    }
    setPreviewProject(proj);
    setPreviewCurrentTime(proj.clip.startTime);
  };
```

4. In the `PreviewScreen` element near the end of the file, replace `videoUrl={previewProject.export?.downloadUrl || previewProject.exportedVideoUrl || ""}` with `videoUrl={videoUrl}`. (`videoUrl` follows `selectedFile` through the existing `fileUrl` effect near the top of `App`.)

5. In the restore modal ("Video kan ikke findes"), replace `igen for at fortsætte redigeringen.` with `igen for at fortsætte.` (the modal now also opens before a preview).

- [ ] **Step 9: Saving and export success**

1. In `handleSaveAndProcess`, replace the line `exportStatus: exportNow ? "exporting" : "not_exported",` with:

```tsx
      // Saved changes make any earlier export outdated
      exportStatus: "not_exported",
      export: undefined,
```

2. Replace the whole `handleExportSuccess` function with:

```tsx
  const handleExportSuccess = async (clip: ExportedClip) => {
    if (!activeProject) return;

    const finished: CoachClipProject = {
      ...activeProject,
      exportStatus: "exported",
      export: {
        status: "exported",
        fileName: clip.fileName,
        fileSize: clip.sizeBytes,
        duration: clip.durationSec,
        width: clip.width,
        height: clip.height,
        exportedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveProject(finished);
    setActiveProject(finished);
    setExportedClip(clip);
    await loadProjectsData();
    setEditorStep("success");
  };

  const handleDeliver = async (mode: "share" | "download") => {
    if (!exportedClip) return;
    try {
      await deliverClip(exportedClip, mode);
    } catch (error) {
      console.error("Delivering the clip failed:", error);
      alert("Klippet kunne ikke deles eller gemmes. Prøv igen.");
    }
  };
```

3. In the `ExportScreen` element, replace

```tsx
                onExportFailed={(errorMsg) => {
                  if (errorMsg && errorMsg !== "Eksporten blev afbrudt." && errorMsg !== "Afbrudt af bruger.") {
                    alert(errorMsg);
                  }
                  setEditorStep("save");
                }}
```

with

```tsx
                onExportFailed={() => setEditorStep("save")}
```

(the export screen already shows the message).

- [ ] **Step 10: Success screen delivers the real file**

Replace the whole block from the line `{/* Screen 9: Success & Share Options */}` through its closing `)}` (the block that renders "Dit klip er klar!") with:

```tsx
            {/* Screen 9: Success & Share Options */}
            {editorStep === "success" && activeProject && exportedClip && (
              <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center animate-scale-up">
                <div className="w-16 h-16 bg-green-50 text-brand-success rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-black text-brand-dark mb-1">Dit klip er klar!</h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Klippet er lavet på din enhed. Del det med holdet, eller gem det som MP4.</p>

                {/* Details card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6 flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Klippets titel:</span>
                    <span className="text-slate-800 font-extrabold max-w-[200px] truncate">{activeProject.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Varighed:</span>
                    <span className="text-slate-800 font-extrabold">{exportedClip.durationSec.toFixed(1)} sekunder</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Format / Opløsning:</span>
                    <span className="text-slate-800 font-extrabold">MP4 / {exportedClip.width}×{exportedClip.height}</span>
                  </div>
                  {exportedClip.audioWarning && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 font-semibold">
                      {AUDIO_WARNING_MESSAGE}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => handleDeliver("share")}
                    className="w-full py-3.5 bg-brand-clear hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-brand-clear/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Share2 className="w-4.5 h-4.5" />
                    <span>Del klip</span>
                  </button>

                  <button
                    onClick={() => handleDeliver("download")}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-850 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-4.5 h-4.5" />
                    <span>Download MP4</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setEditorStep("editor")}
                      className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Rediger igen
                    </button>
                    <button
                      onClick={() => {
                        setTrimRange({ startTime: 0, endTime: videoDuration });
                        setAnnotations([]);
                        setEditorStep("trim");
                      }}
                      className="py-2.5 bg-brand-dark hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Nyt klip fra video
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setEditorStep("idle");
                      setCurrentTab("projects");
                    }}
                    className="text-xs text-brand-clear font-bold mt-4 hover:underline cursor-pointer"
                  >
                    Gå til Mine projekter
                  </button>
                </div>
              </div>
            )}
```

- [ ] **Step 11: Project cards use `isProjectExported`**

1. In `src/screens/ProjectLibraryScreen.tsx`:
   - Add `import { isProjectExported } from "../utils/projectStatus";` below the `CoachClipProject` import.
   - Replace the two-line `const isExported = (proj.export?.status === "exported" || …` expression inside `getFilteredProjects` with `const isExported = isProjectExported(proj);`.
   - Delete the expired banner block that starts with `{proj.export?.status === "expired" ||` and ends with `) : null}`.
   - Replace the IIFE badge block that starts with `{(() => {` and ends with `})()}` with:

```tsx
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      isProjectExported(proj) ? "bg-green-50 text-brand-success" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {isProjectExported(proj) ? "Eksporteret" : "Ikke eksporteret"}
                  </span>
```

2. In `src/screens/HomeScreen.tsx`:
   - Add `import { isProjectExported } from "../utils/projectStatus";` below the `CoachClipProject` import.
   - Replace both occurrences of `proj.exportStatus === "exported"` with `isProjectExported(proj)`.
   - Replace the step text `"Upload en trænings- eller kampvideo direkte fra din mobil eller computer."` with `"Vælg en trænings- eller kampvideo direkte fra din mobil eller computer."`.

- [ ] **Step 12: Remove the fake Collections player**

In `src/components/CollectionsScreen.tsx`:
1. Delete the playlist state block (the comment `// Playback Playlist Modal` and the six `useState`/`useRef` lines below it).
2. Delete everything from the comment `// Playback Playlist logic` through the line `const activePlaylistAnnos = getActivePlaylistAnnotations();` (this removes `startPlaylist`, `activePlaylistProject`, the video-source effect, `handlePlaylistTimeUpdate`, `getActivePlaylistAnnotations`).
3. Delete the "Afspil samling" `<button onClick={() => startPlaylist(activeCol)} …>…</button>` element.
4. Delete the block from the comment `{/* PLAYLIST IMMERSIVE PLAYBACK VIEWER */}` through its closing `)}`.
5. Replace the text `Her kan du sammensætte klip, ændre rækkefølge og afspille dem som et taktikmøde.` with `Her kan du sammensætte klip og ændre rækkefølgen til et taktikmøde.`
6. Replace the three import statements at the top with:

```tsx
import React, { useState, useEffect } from "react";
import {
  FolderHeart, Plus, Trash2, ArrowUp, ArrowDown,
  Video, ChevronRight, X, FolderPlus, Clock, Film
} from "lucide-react";
import { Collection, CoachClipProject } from "../types";
```

(`useEffect` stays: collections are loaded in one.)

- [ ] **Step 13: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: no type errors, no new lint warnings, unit tests pass (existing + 6 new), build succeeds. `grep -rn "downloadUrl\|expiresAt\|exportedVideoUrl\|/api/" src` prints nothing.

- [ ] **Step 14: Commit**

```bash
git add src
git commit -m "feat(ui): export clips in the browser and deliver the file from the success screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: One canvas renderer for every annotation preview

**Files:**
- Create: `src/features/annotations/AnnotationCanvas.tsx`, `src/features/annotations/measureAnnotationText.ts`
- Modify: `src/features/annotations/AnnotationEditor.tsx`
- Modify: `src/features/annotations/circle/CircleAnnotationView.tsx`, `src/features/annotations/arrow/ArrowAnnotationView.tsx`, `src/features/annotations/text/TextAnnotationView.tsx`
- Modify: `src/App.tsx` (review step), `src/screens/PreviewScreen.tsx`

**Interfaces:**
- Consumes: `renderAnnotations`, `annotationFont` (Task 1); `layoutTextAnnotation` from `shared/annotationGeometry.ts`; `getDisplayedVideoBounds`, `type VideoBounds` from `src/utils/videoUtils.ts`.
- Produces:
  - `AnnotationCanvas` props `{ videoRef: React.RefObject<HTMLVideoElement | null>; annotations: Annotation[]; time: number; zIndexClassName?: string }`, rendering `<canvas data-testid="annotation-canvas">` (used by Task 4 E2E)
  - `measureAnnotationText(line: string, fontSize: number): number`

- [ ] **Step 1: Create `measureAnnotationText.ts`**

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotationFont } from "../../export/renderAnnotations";

let context: CanvasRenderingContext2D | null = null;

// Measures text exactly like the export canvas so DOM hit areas line up with the drawn text boxes.
export function measureAnnotationText(line: string, fontSize: number): number {
  if (!context) context = document.createElement("canvas").getContext("2d");
  if (!context) return line.length * fontSize * 0.52;
  context.font = annotationFont(fontSize);
  return context.measureText(line).width;
}
```

- [ ] **Step 2: Create `AnnotationCanvas.tsx`**

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import type { Annotation } from "../../types";
import { renderAnnotations } from "../../export/renderAnnotations";
import { getDisplayedVideoBounds, type VideoBounds } from "../../utils/videoUtils";

interface AnnotationCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  annotations: Annotation[];
  time: number;
  zIndexClassName?: string;
}

// Draws annotations over the visible area of a contain-fitted <video> with the same renderer the
// export uses, so the preview matches the exported clip. It never receives pointer events.
export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ videoRef, annotations, time, zIndexClassName = "z-10" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bounds, setBounds] = useState<VideoBounds | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = video?.parentElement;
    if (!video || !container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setBounds(getDisplayedVideoBounds(rect.width, rect.height, video.videoWidth, video.videoHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    video.addEventListener("loadedmetadata", update);
    return () => {
      observer.disconnect();
      video.removeEventListener("loadedmetadata", update);
    };
  }, [videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    renderAnnotations(ctx, width, height, annotations, time);
  }, [bounds, annotations, time]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="annotation-canvas"
      aria-hidden="true"
      className={`absolute pointer-events-none ${zIndexClassName}`}
      style={bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : { display: "none" }}
    />
  );
};
```

- [ ] **Step 3: Review step in `App.tsx`**

1. Add `import { AnnotationCanvas } from "./features/annotations/AnnotationCanvas";` next to the other feature imports.
2. Change the types import line to `import { CoachClipProject, Collection, Annotation } from "./types";`.
3. In the review step, replace the block that starts with the line `{/* Overlays */}` and ends with the closing `</div>` of `<div className="absolute inset-0 pointer-events-none select-none z-20">` with:

```tsx
                  <AnnotationCanvas videoRef={previewVideoRef} annotations={annotations} time={previewCurrentTime} zIndexClassName="z-20" />
```

- [ ] **Step 4: `PreviewScreen.tsx`**

1. Replace the file header comment block (the `eslint-disable` line and the license comment with "Documented exceptions") with:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
```

2. Add `import { AnnotationCanvas } from "../features/annotations/AnnotationCanvas";` below the `formatPreciseTime` import.
3. Delete the `// Filter annotations valid at this preview time` comment and the `activeAnnotations` constant.
4. Replace the block that starts with `{/* Read-Only Overlays synchronized perfectly */}` and ends with the closing `</div>` of `<div className="absolute inset-0 pointer-events-none select-none z-20">` with:

```tsx
          <AnnotationCanvas videoRef={videoRef} annotations={project.annotations} time={currentTime} zIndexClassName="z-20" />
```

- [ ] **Step 5: Editor draws with the canvas and knows the real video size**

In `src/features/annotations/AnnotationEditor.tsx`:

1. Add `import { AnnotationCanvas } from "./AnnotationCanvas";` below the `AnnotationOverlay` import.
2. Below `const containerRef = useRef<HTMLDivElement>(null);` add:

```tsx
  // Real video size so letterboxing (e.g. portrait phone video) places annotations correctly
  const [videoSize, setVideoSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
```

3. On the `<video ref={videoRef} …>` element add the prop:

```tsx
              onLoadedMetadata={(e) => setVideoSize({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })}
```

4. Directly after the closing `/>` of that `<video>` element add:

```tsx
            <AnnotationCanvas
              videoRef={videoRef}
              annotations={draftAnnotation ? [...annotations, draftAnnotation as Annotation] : annotations}
              time={currentTime}
            />
```

5. On `<AnnotationOverlay …>` add the props:

```tsx
              videoWidth={videoSize.width || undefined}
              videoHeight={videoSize.height || undefined}
```

6. Replace the whole `{/* Active Freeze Overlay (Large visual countdown timer) */}` block (the `freezeActiveId && (…)` element with the blurred layer and the ring) with:

```tsx
            {/* Freeze: the paused frame and its annotations stay visible, like in the exported clip */}
            {freezeActiveId && (
              <div className="absolute top-3 right-3 z-40 bg-slate-900/85 border border-sky-400/60 text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-bold shadow-lg pointer-events-none">
                <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                <span>Frys · {freezeRemaining}s</span>
              </div>
            )}
```

- [ ] **Step 6: Views become invisible drag handles**

1. `CircleAnnotationView.tsx`: delete the `// Color mapping` comment and the `strokeColor` constant, and replace the inner `{/* Circle Shape */}` element with:

```tsx
      {/* Hit area; the circle itself is drawn by AnnotationCanvas */}
      <div className={`w-full h-full rounded-full transition-shadow ${isSelected ? "ring-2 ring-blue-400" : ""}`} />
```

2. `ArrowAnnotationView.tsx`: delete the `// Arrow color` comment and the `strokeColor` constant. Inside the `<svg>`, delete the `<defs>…</defs>` block and the `{/* Real visible vector */}` `<line>` element, keeping only the transparent clickable line.

3. `TextAnnotationView.tsx`: replace the imports and everything from `// Size mapping` to the end of the component's return with:

```tsx
  const layout = layoutTextAnnotation(
    videoBounds.width,
    videoBounds.height,
    annotation.x,
    annotation.y,
    annotation.size,
    annotation.text,
    measureAnnotationText
  );
  const isEmpty = layout.lines.length === 0;

  // Hit area sized like the drawn text box; the text itself is drawn by AnnotationCanvas.
  // An empty draft has nothing to draw, so it shows a visible placeholder instead.
  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute cursor-move select-none z-20 rounded-lg touch-action-none ${
        isSelected ? "ring-2 ring-blue-400" : ""
      } ${isEmpty ? "bg-black/60 text-white/80 text-xs font-semibold px-3 py-1.5 -translate-x-1/2 -translate-y-1/2" : ""}`}
      style={
        isEmpty
          ? {
              left: `${annotation.x * videoBounds.width + videoBounds.left}px`,
              top: `${annotation.y * videoBounds.height + videoBounds.top}px`,
              pointerEvents: "auto",
            }
          : {
              left: `${videoBounds.left + layout.rectX}px`,
              top: `${videoBounds.top + layout.rectY}px`,
              width: `${layout.boxWidth}px`,
              height: `${layout.boxHeight}px`,
              pointerEvents: "auto",
            }
      }
    >
      {isEmpty ? "Indtast tekst..." : null}
    </div>
  );
};
```

with these imports at the top of the file:

```tsx
import React from "react";
import { TextAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";
import { layoutTextAnnotation } from "../../../../shared/annotationGeometry";
import { measureAnnotationText } from "../measureAnnotationText";
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: clean. `grep -rn "markerEnd\|arrowhead-\|arrow-rev-\|arrow-pre-\|BRAND_COLORS.accent" src` prints nothing.

- [ ] **Step 8: Manual check in the browser**

Run `npx vite --port 5173`, open `http://localhost:5173` in Chrome, pick `e2e/fixtures/media/landscape-tone.mp4`, go to "Forklar situationen", add a text, a circle and an arrow. Check that they appear, can be dragged, and look the same on the review screen. Then pick `e2e/fixtures/media/portrait-rotated-silent.mp4` and check that a circle placed in the editor stays on the same spot on the review screen. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(ui): draw every annotation preview with the export's canvas renderer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: E2E on the built app in Chrome under the production headers

**Files:**
- Create: `vercel.json`
- Modify: `vite.config.ts`
- Rewrite: `playwright.config.ts`, `e2e/fixtures/testVideo.ts`, `e2e/export-flow.spec.ts`, `e2e/cancel-export.spec.ts`
- Create: `e2e/fixtures/appFlow.ts`
- Delete: `e2e/api-contract.spec.ts`, `e2e/cors.spec.ts`, `e2e/export-expiry.spec.ts`, `e2e/sw-cache.spec.ts`, `scripts/generateE2EVideo.ts`
- Modify: `package.json` (`verify:e2e`, `test:e2e`)

**Interfaces:**
- Consumes: `data-testid="annotation-canvas"` (Task 3); success screen buttons "Del klip"/"Download MP4" (Task 2); export screen texts "Opretter dit taktikklip", "Afbryd eksport", "Eksporten blev afbrudt" (Task 2).
- Produces: `openEditorWithTestVideo(page)`, `saveAndExport(page)`, `countOpfsExportFiles(page)` in `e2e/fixtures/appFlow.ts`; `TEST_VIDEO` in `e2e/fixtures/testVideo.ts`.

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: data:"
        },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

Why these sources: Mediabunny and the wasm AAC encoder start workers from `blob:` URLs and compile WebAssembly (`'wasm-unsafe-eval'`); the encoder may fetch its wasm from a `blob:`/`data:` URL; the source video plays from a `blob:` URL; `src/index.css` imports Google Fonts.

- [ ] **Step 2: `vite preview` serves the same headers**

Replace `vite.config.ts` with (keep an `optimizeDeps` entry here if Task 1 added one):

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

type VercelConfig = { headers: { source: string; headers: { key: string; value: string }[] }[] };

// `vite preview` serves the production build with the same security headers as Vercel, so the
// E2E tests exercise the app under the real Content-Security-Policy.
const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8')) as VercelConfig;
const securityHeaders = Object.fromEntries(vercelConfig.headers[0].headers.map(({ key, value }) => [key, value]));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    preview: {
      headers: securityHeaders,
    },
    test: {
      exclude: ['e2e/**/*', 'node_modules/**/*', 'dist/**/*'],
    },
  };
});
```

- [ ] **Step 3: Playwright runs the build in Chrome**

Replace `playwright.config.ts` with:

```ts
import { defineConfig } from "@playwright/test";

const E2E_ORIGIN = "http://127.0.0.1:3001";

// Runs the built app in Google Chrome under the production security headers (see vite.config.ts).
// Chrome is required because exports encode H.264, which Playwright's bundled Chromium cannot.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["engine/**"],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: E2E_ORIGIN,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 3001 --strictPort",
    url: E2E_ORIGIN,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
```

- [ ] **Step 4: Fixtures and shared flow**

Replace `e2e/fixtures/testVideo.ts` with:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Committed fixture: 640x360, 30 fps, 8 s, 440 Hz tone with silent gaps (see scripts/generateExportFixtures.ts)
export const TEST_VIDEO = {
  path: "e2e/fixtures/media/landscape-tone.mp4",
  durationSeconds: 8,
  width: 640,
  height: 360,
};
```

Create `e2e/fixtures/appFlow.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, type Page } from "@playwright/test";
import { TEST_VIDEO } from "./testVideo";

export async function openEditorWithTestVideo(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("button:has-text('Nyt analyseklip')").first().click();
  await expect(page.locator("h3:has-text('Vælg kamp- eller træningsvideo')")).toBeVisible();
  await page.setInputFiles("input[type='file']", TEST_VIDEO.path);
  await page.locator("button:has-text('Fortsæt til klip-trimning')").click();
  await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10_000 });
  await page.locator("button:has-text('Næste: Finjustering')").click();
  await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
  await page.locator("button:has-text('Klip er korrekt: Tegn')").click();
  await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
}

export async function saveAndExport(page: Page): Promise<void> {
  await page.locator("button:has-text('Næste: Gennemse klip')").click();
  await expect(page.locator("h3:has-text('Gennemse dit klip')")).toBeVisible();
  await page.locator("button:has-text('Ja, gem klip')").click();
  await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
  await page.locator("button:has-text('Gem og eksportér')").click();
}

export async function countOpfsExportFiles(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const root = (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };
    let count = 0;
    for await (const name of root.keys()) {
      if (name.startsWith("coachclip-export-")) count++;
    }
    return count;
  });
}
```

- [ ] **Step 5: Rewrite the export flow test**

Replace `e2e/export-flow.spec.ts` with:

```ts
import { test, expect } from "@playwright/test";
import fs from "fs";
import { ALL_FORMATS, FilePathSource, Input } from "mediabunny";
import { countOpfsExportFiles, openEditorWithTestVideo, saveAndExport } from "./fixtures/appFlow";
import { TEST_VIDEO } from "./fixtures/testVideo";

const overlay = ".absolute.inset-0.z-20.pointer-events-auto";

test.describe("CoachClip - Full E2E Export Flow", () => {
  test("draws annotations, exports in the browser and downloads a valid MP4", async ({ page }) => {
    await openEditorWithTestVideo(page);

    const video = page.locator("video");
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).videoWidth))
      .toBe(TEST_VIDEO.width);

    await page.locator("button:has-text('Tilføj tekst')").first().click();
    await page.locator(overlay).click({ position: { x: 300, y: 150 } });
    await page.fill("textarea", "E2E Test: Gå dybt!");
    await page.locator("button:has-text('Gem')").click();

    await page.locator("button:has-text('Marker spiller')").first().click();
    await page.locator(overlay).click({ position: { x: 200, y: 200 } });
    await page.locator("button:has-text('Gem')").click();

    // The editor preview is drawn by the export's canvas renderer
    await expect
      .poll(() =>
        page.locator("[data-testid='annotation-canvas']").first().evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (!ctx) return 0;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let drawn = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
          return drawn;
        })
      )
      .toBeGreaterThan(500);

    await page.locator("button:has-text('Vis bevægelse')").first().click();
    const box = await page.locator(overlay).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 250, box!.y + 250);
    await page.mouse.up();
    await page.locator("button:has-text('Gem')").click();

    await page.locator("button:has-text('Frys billede')").first().click();
    await page.locator("button:has-text('Gem')").click();

    await saveAndExport(page);
    await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
    await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 90_000 });

    // The success screen shows the planned length (clip + 3 s freeze); the file must match it
    const durationText = await page.getByText(/^\d+\.\d sekunder$/).textContent();
    const shownDuration = parseFloat(durationText ?? "");
    expect(shownDuration).toBeGreaterThan(3);
    await expect(page.getByText(`MP4 / ${TEST_VIDEO.width}×${TEST_VIDEO.height}`)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("button:has-text('Download MP4')").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.mp4$/);
    const downloadPath = await download.path();
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);

    const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(downloadPath) });
    try {
      const track = await input.getPrimaryVideoTrack();
      expect(await track?.getCodec()).toBe("avc");
      expect(await track?.getDisplayWidth()).toBe(TEST_VIDEO.width);
      expect(Math.abs((await input.computeDuration()) - shownDuration)).toBeLessThan(0.15);
    } finally {
      input.dispose();
    }

    await page.locator("button:has-text('Gå til Mine projekter')").click();
    await expect.poll(() => countOpfsExportFiles(page)).toBe(0);
  });
});
```

- [ ] **Step 6: Rewrite the cancel test**

Replace `e2e/cancel-export.spec.ts` with:

```ts
import { test, expect } from "@playwright/test";
import { countOpfsExportFiles, openEditorWithTestVideo, saveAndExport } from "./fixtures/appFlow";

test.describe("CoachClip - Export Cancellation", () => {
  test("cancelling a running export shows a neutral message and leaves no export files", async ({ page }) => {
    await openEditorWithTestVideo(page);

    // Slow the page down so the export is still running when cancel is clicked
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });

    await saveAndExport(page);
    await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
    await page.locator("button:has-text('Afbryd eksport')").click();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    await expect(page.locator("h3:has-text('Eksporten blev afbrudt')")).toBeVisible();
    await expect(page.locator("h3:has-text('Eksporten fejlede')")).toHaveCount(0);
    await expect.poll(() => countOpfsExportFiles(page)).toBe(0);
  });
});
```

- [ ] **Step 7: Delete server-only tests and update scripts**

```bash
git rm e2e/api-contract.spec.ts e2e/cors.spec.ts e2e/export-expiry.spec.ts e2e/sw-cache.spec.ts scripts/generateE2EVideo.ts
```

In `package.json` scripts, add `"test:e2e": "playwright test",` below `"test:engine"`, and change `"verify:e2e"` to `"npm run test:e2e"`.

In `e2e/app.spec.ts`, replace the comment `// Navigate to base URL (Vite + Express on 3000)` with `// Navigate to the built app`.

- [ ] **Step 8: Run the E2E suite**

Run: `npm run test:e2e`
Expected: 5 passed (app ×2, delete-projects, export-flow, cancel-export). The browser console must show no CSP violations. If the export fails under the CSP, read the console message in the Playwright trace, adjust only the directive that blocks (for example add `blob:` where a blob resource is refused), re-run, and record the change in the commit message.

- [ ] **Step 9: Run the engine suite and unit tests**

Run: `npm run test && npm run test:engine`
Expected: unit tests pass, engine 10 passed.

- [ ] **Step 10: Commit**

```bash
git add vercel.json vite.config.ts playwright.config.ts e2e package.json
git commit -m "test(e2e): run the built app in Chrome under the production security headers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Remove the server, AI Studio leftovers and dead code

**Files:**
- Delete: `server/`, `server.ts`, `Dockerfile`, `.dockerignore`, `scripts/smokeApiSimple.ts`, `scripts/smokeExportAnnotations.ts`, `scripts/smokeExportArrow.ts`, `scripts/smokeExportCircle.ts`, `scripts/smokeExportCombined.ts`, `scripts/smokeExportFreeze.ts`, `scripts/smokeExportNoAudio.ts`, `scripts/smokeExportSimple.ts`, `scripts/smokeExportText.ts`, `shared/exportJob.ts`, `metadata.json`, `.env.example`, `public/sw.js`, `src/components/EditorScreen.tsx`, `src/components/TrimScreen.tsx`, `src/hooks/useAutosave.ts`
- Modify: `shared/exportSchema.ts`, create `shared/exportSchema.test.ts`
- Modify: `shared/annotationGeometry.ts`, `shared/annotationGeometry.test.ts`, `shared/annotations.ts`
- Modify: `package.json`, `package-lock.json`, `src/main.tsx`, `src/App.tsx`, `src/components/UserGuide.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `package.json` scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `test:engine`, `test:e2e`, `verify:*`, `verify` (used by Task 6 CI).

- [ ] **Step 1: Keep the file-name sanitizer tests before deleting the server tests**

Create `shared/exportSchema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeExportFileName } from "./exportSchema";

describe("sanitizeExportFileName", () => {
  it("replaces Danish characters and punctuation", () => {
    expect(sanitizeExportFileName("Træning og øvelse på Åen")).toBe("Traening_og_oevelse_paa_Aaen.mp4");
    expect(sanitizeExportFileName("   Spiller 1 - Skud! ???   ")).toBe("Spiller_1_-_Skud.mp4");
    expect(sanitizeExportFileName("Spillerens' skud")).toBe("Spillerens_skud.mp4");
  });

  it("strips path traversal and separators", () => {
    expect(sanitizeExportFileName("../../etc/passwd")).toBe("etcpasswd.mp4");
    expect(sanitizeExportFileName("test/../../../file")).toBe("testfile.mp4");
    expect(sanitizeExportFileName("C:\\Windows\\system32")).toBe("CWindowssystem32.mp4");
  });

  it("limits length and falls back for empty titles", () => {
    const long = sanitizeExportFileName("a".repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith(".mp4")).toBe(true);
    expect(sanitizeExportFileName("")).toBe("CoachClip.mp4");
    expect(sanitizeExportFileName("   ")).toBe("CoachClip.mp4");
  });

  it("prefixes Windows reserved names", () => {
    expect(sanitizeExportFileName("CON")).toBe("_CON.mp4");
    expect(sanitizeExportFileName("PRN")).toBe("_PRN.mp4");
    expect(sanitizeExportFileName("AUX")).toBe("_AUX.mp4");
    expect(sanitizeExportFileName("NUL")).toBe("_NUL.mp4");
  });
});
```

Run: `npx vitest run shared/exportSchema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 2: Delete server, Docker, smoke scripts and dead code**

```bash
git rm -r server server.ts Dockerfile .dockerignore scripts/smokeApiSimple.ts scripts/smokeExportAnnotations.ts scripts/smokeExportArrow.ts scripts/smokeExportCircle.ts scripts/smokeExportCombined.ts scripts/smokeExportFreeze.ts scripts/smokeExportNoAudio.ts scripts/smokeExportSimple.ts scripts/smokeExportText.ts shared/exportJob.ts metadata.json .env.example public/sw.js src/components/EditorScreen.tsx src/components/TrimScreen.tsx src/hooks/useAutosave.ts
```

`src/hooks/usePointerDrag.ts` stays: the annotation views use it.

- [ ] **Step 3: Drop server-only shared code**

1. In `shared/exportSchema.ts`, delete the line `import { Annotation } from "./annotations";` and the whole `export type ExportRequestMetadata = { … };` block.
2. In `shared/annotations.ts`, replace the comment

```ts
// Single source of annotation types for browser preview and FFmpeg render.
// Export job status/stage types live in ./exportJob.ts.
```

with

```ts
// Single source of annotation types for the editor, the canvas preview and the browser export.
```

3. In `shared/annotationGeometry.ts`:
   - Delete the `ARROW_GEOMETRY` constant, the `CIRCLE_GEOMETRY` constant and the whole `getTextGeometry` function.
   - In `getArrowGeometry`, replace `strokeWidth: ARROW_GEOMETRY.strokeWidth,` with `strokeWidth: ANNOTATION_STYLE.arrowStroke,`.
   - Replace the comment `// ---- Canvas rendering geometry (shared by browser preview and browser export) ----` with `// ---- Canvas rendering geometry (shared by canvas preview and browser export) ----`.
4. In `shared/annotationGeometry.test.ts`, remove `getTextGeometry,` from the import list and delete the test `it("matches the legacy getTextGeometry wrapping", …)`.

- [ ] **Step 4: Unregister the old service worker**

Replace `src/main.tsx` with:

```tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Earlier versions registered a do-nothing service worker; remove it from devices that still have it.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}
```

- [ ] **Step 5: Texts that described the server or offline mode**

1. In `src/App.tsx`, replace the settings block from `<h4 className="text-sm font-bold text-slate-800 mb-1">PWA Offline status</h4>` through the closing `</div>` of `<div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-brand-success">` with:

```tsx
                        <h4 className="text-sm font-bold text-slate-800 mb-1">Eksport på din enhed</h4>
                        <p className="text-xs text-slate-500">Klip laves direkte i din browser – videoen sendes ingen steder. På iPhone og iPad kræver det iOS 26 eller nyere.</p>
```

2. In `src/components/UserGuide.tsx`:
   - Replace the FAQ answer that starts with `"Nej, for at beskytte din enheds hukommelse` with `"Nej. CoachClip arbejder direkte på den videofil, du vælger på din enhed, og selve eksporten sker også i din browser. Videoen sendes ingen steder."`.
   - Replace the FAQ entry with the question `"Hvordan kan jeg bruge CoachClip offline?"` with question `"Kan jeg bruge CoachClip uden internet?"` and answer `"Appen skal have internet for at åbne. Når den er åben, sker redigering og eksport på din enhed."`.
   - Replace the comment `{/* Card 3: Privacy & Server rendering */}` with `{/* Card 3: Privacy */}`.
   - Replace the heading `3. Fortrolighed & Midlertidig rendering` with `3. Fortrolighed: alt sker på din enhed`.
   - Replace the paragraph that starts with `Under selve eksporten opretter CoachClip en midlertidig renderingsjob` with: `Klippet laves direkte i din browser. Videoen og det færdige klip forlader aldrig din enhed, og den midlertidige eksportfil slettes, når du forlader skærmen med det færdige klip. Dine videoer og holddata tilhører 100% dig.`
   - In the downloads card, replace the paragraph that starts with `Når du trykker på <strong>Download MP4</strong>` with: `Når klippet er færdigt, kan du trykke <strong>Del klip</strong> for at sende det via WhatsApp, AirDrop eller gemme det i Fotos, eller <strong>Download MP4</strong> for at gemme filen i din enheds <strong>Overførsler-mappe (Downloads)</strong>.`

- [ ] **Step 6: `package.json`**

Run: `npm uninstall express multer @types/express @types/multer esbuild pixelmatch @types/pixelmatch pngjs @types/pngjs`

Then edit `package.json`: set `"name": "coachclip"` and `"version": "1.0.0"`, and replace the whole `"scripts"` object with:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:engine": "playwright test -c playwright.engine.config.ts",
    "test:e2e": "playwright test",
    "verify:lint": "npm run lint",
    "verify:typecheck": "npm run typecheck",
    "verify:unit": "npm run test",
    "verify:build": "npm run build",
    "verify:engine": "npm run test:engine",
    "verify:e2e": "npm run test:e2e",
    "verify": "npm run verify:lint && npm run verify:typecheck && npm run verify:unit && npm run verify:build && npm run verify:engine && npm run verify:e2e"
  },
```

`tsx` stays in devDependencies (used by `scripts/generateExportFixtures.ts`).

- [ ] **Step 7: Verify nothing still points at the removed code**

Run: `grep -rnE "server/|/api/|express|multer|ffprobe|sw\.js|exportJob|ExportRequestMetadata|getTextGeometry|ARROW_GEOMETRY|CIRCLE_GEOMETRY|GEMINI|DISABLE_HMR" --include=*.ts --include=*.tsx --include=*.json --include=*.html src shared e2e scripts index.html vite.config.ts playwright*.ts package.json`
Expected: no output.

Run: `npm run verify`
Expected: lint, typecheck, unit, build, engine (10) and E2E (5) all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove the Express/FFmpeg server, Docker, smoke tests and dead code

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: CI, CLAUDE.md and README

**Files:**
- Rewrite: `.github/workflows/verify.yml`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: `npm run verify` (Task 5).

- [ ] **Step 1: CI workflow**

Replace `.github/workflows/verify.yml` with:

```yaml
name: Verify CoachClip

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Node Dependencies
        run: npm ci

      - name: Install Google Chrome for Playwright
        run: npx playwright install --with-deps chrome

      - name: Verify (Lint, Typecheck, Unit, Build, Engine, E2E)
        run: npm run verify

      - name: Upload Playwright failure artifacts
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          if-no-files-found: ignore
```

- [ ] **Step 2: Rewrite `CLAUDE.md`**

Replace `CLAUDE.md` with:

````markdown
# CoachClip

Taktisk videoklip-værktøj til sportstrænere. Træneren vælger en videofil, finder
situationen, tilføjer markeringer (tekst, cirkel, pil, frysebillede) og eksporterer en
færdig MP4 hvor markeringerne er brændt ind i billedet.

Statisk web-app: React 19 + Vite 6 + Tailwind 4. **Hele eksporten sker i trænerens
browser** med Mediabunny (WebCodecs). Der er ingen server. Projekter gemmes i browserens
IndexedDB; videoer gemmes aldrig. **Intet login, ingen serverdatabase, ingen AI-analyse**
— det er bevidste valg, ikke mangler der skal udfyldes.

## Kommandoer

```bash
npm run dev          # Vite på http://localhost:5173
npm run verify       # HELE porten: lint → typecheck → unit → build → engine → E2E
npm test             # kun vitest
npm run test:engine  # eksportmotoren i Chrome mod testvideoer (e2e/engine)
npm run test:e2e     # hele appen bygget, i Chrome, under produktions-CSP
```

**Forudsætninger:** Node 20 eller 22 (`engines: >=20 <23`). **Google Chrome** skal være
installeret: både engine- og E2E-tests kører Playwright med `channel: "chrome"`, fordi
Playwrights egen Chromium ikke kan H.264-encode. CI kører Node 20. FFmpeg bruges kun til at
genskabe testvideoerne (`npx tsx scripts/generateExportFixtures.ts`), ikke af appen.

`npm run verify` skal være grøn før commit.

## Arkitektur

```
src/export/        Eksportmotoren (ingen React): exportClip, planSegments, renderAnnotations,
                   decodeClipAudio, exportStorage (OPFS), capabilities, deliverClip, exportErrors
src/               React-app. App.tsx er én state machine for flowet (editorStep).
                   screens/ = flowets trin. features/annotations/ = editor + AnnotationCanvas.
shared/            Typer, geometri, validering, filnavn. Bruges af app og motor.
e2e/engine/        Motoren i Chrome via harness (e2e/harness, kun dev) mod e2e/fixtures/media
e2e/               App-scenarier (eksport, annullering, sletning) på den byggede app
vercel.json        Build + sikkerheds-headers (CSP). vite preview bruger de samme headers.
```

### Eksport-pipelinen

`ExportScreen` kalder `exportClip({ file, project, signal, onProgress })`. Motoren validerer
(`shared/exportValidation.ts`), planlægger en tidslinje af video- og frysstykker
(`planSegments`), afkoder lyden først (WebCodecs, ellers Web Audio), tegner hvert billede i
konstant 30 fps på et canvas med `renderAnnotations`, koder H.264/AAC og skriver MP4 til
OPFS. Fejl er altid `ExportError` med dansk besked. Succesiden deler filen med
`deliverClip` (delemenu eller download).

## Regler der skal holdes

**Dansk til brugeren.** Al brugervendt tekst er på dansk, skrevet til en træner. Kode,
kommentarer og commits er på engelsk.

**Én tegnemotor.** `renderAnnotations` bruges af både eksport og al forhåndsvisning
(`AnnotationCanvas`). DOM-elementerne i editoren er kun usynlige træk-håndtag. Tegn aldrig
en markering med egen SVG/CSS — så holder preview og klip op med at ligne hinanden.

**Geometri og typer i `shared/`.** Formler hører i `shared/annotationGeometry.ts`, typer i
`shared/annotations.ts`. `src/types.ts` ejer kun app-modeller (projekt, samling).

**Koordinater er altid relative (0–1), tider er kildesekunder.** Aldrig pixels i datamodellen.

**Ryd op i OPFS.** Eksportfiler (`coachclip-export-*`) slettes ved app-start, når en ny
eksport starter, når man forlader succesiden, og ved afbrudt/fejlet eksport.

**Mediabunny er fastlåst til 1.56.2.** Opdatér kun bevidst og kør `npm run test:engine`.

**Ingen inline- eller eksterne scripts.** CSP'en i `vercel.json` tillader dem ikke.

**Understøttet:** iPhone/iPad med iOS 26+ og Chrome/Edge/Safari på computer. Motoren
sniffer ikke brugeragent; mangler browseren WebCodecs, vises `UNSUPPORTED_BROWSER`.

## Ude af scope

Login og brugerstyring, cloud-videogalleri, AI-analyse eller tracking, baggrundsmusik,
visuelle overgange, offline-brug. Foreslå det ikke som "forbedringer".

## Åbne punkter

- **iPhone-tjekliste før udrulning:** 4K lodret eksport (hastighed), HEVC-video, skærm slukket
  midt i eksport, Gem i Fotos via delemenuen.
- **Skærm slukket kan få eksporten til at hænge** i stedet for at fejle med `INTERRUPTED`
  (iOS kan pause encoderen). En watchdog er ikke lavet.
- **Lydkodning der fejler** (usædvanlig samplerate) giver `UNKNOWN` i stedet for et klip uden lyd.
- **Afbryd mærkes mellem trin**, ikke midt i lydafkodning eller når filen afsluttes.
- **Afkodningsfejl midt i videoen** (fx HEVC) giver `UNKNOWN`, ikke `UNREADABLE_VIDEO`.
- **iOS 17–18** kan virke, men er ikke understøttet eller testet.
- **PWA-ikonerne** i `public/manifest.json` peger på Unsplash og blokeres af CSP'en.

## Windows-noter

Udvikles på Windows (E:\Projekter\CoachClip).

- Playwright spawner webServer via `cmd.exe`: sæt aldrig env-variabler som prefiks i `command`.
- E2E bruger port 3001 og engine-tests port 3002; de skal være frie.
- WinGet installerer ffmpeg i `%LOCALAPPDATA%\Microsoft\WinGet\Links`, som ikke er i Git
  Bash' PATH. Kun relevant for `scripts/generateExportFixtures.ts`.

## Deployment

Vercel-projektet `coachclip` er forbundet til GitHub-repoet. Production branch skal være
`main`, og domænet `coachclip.coachapp.dk` peges til Vercel med en CNAME hos Simply.com.
Previews kræver Vercel-login; production er offentlig.
````

- [ ] **Step 3: Rewrite `README.md`**

Replace `README.md` with:

````markdown
# CoachClip

Taktiske videoklip til sportstrænere: vælg en video, find situationen, tegn tekst, cirkler,
pile og frysebilleder, og få en færdig MP4 med markeringerne brændt ind.

Alt sker i din browser. Videoen sendes ingen steder, og der er intet login. Projekter gemmes
lokalt i browseren (IndexedDB).

## Kom i gang

Kræver Node.js 20 eller 22 og Google Chrome (til testene).

```bash
npm ci
npm run dev
```

Åbn http://localhost:5173.

## Kvalitetskontrol

```bash
npm run verify
```

Kører lint, typecheck, enhedstests, build, eksportmotorens tests i Chrome og E2E-tests af den
byggede app i Chrome under produktionens sikkerheds-headers.

## Understøttede enheder

iPhone og iPad med iOS 26 eller nyere, samt Chrome, Edge og Safari på computer.

## Udrulning

Appen er et statisk site på Vercel (`vercel.json`). Se `CLAUDE.md` for arkitektur og regler.
````

- [ ] **Step 4: Add `INVALID_PROJECT` to the spec's error table**

In `docs/superpowers/specs/2026-09-13-browser-export-design.md` section 7, insert this row directly below the `UNREADABLE_VIDEO` row:

```markdown
| `INVALID_PROJECT` | Projektet fejler valideringen (klip, varighed eller markeringer) | Valideringens egen danske besked, fx "Det valgte klip skal være mindst 0,5 sekunder." |
```

- [ ] **Step 5: Verify and commit**

Run: `npm run verify`
Expected: all green.

```bash
git add .github/workflows/verify.yml CLAUDE.md README.md docs/superpowers/specs/2026-09-13-browser-export-design.md
git commit -m "docs, ci: document the serverless app and drop FFmpeg and Docker from CI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Carry-over coverage

Items from memory `coachclip-pr-c-carryover` and the PR #5 reviews:

| Item | Where |
|---|---|
| OPFS cleanup at app start, new export, leaving success screen | Task 2 Steps 6–7 |
| Dynamic import of `@mediabunny/aac-encoder` | Task 1 Step 9 |
| `deliverClip` falls back to download on `NotAllowedError` | Task 1 Steps 5–7 |
| Zero WebCodecs audio samples try Web Audio; no false warning when audio ends before the clip | Task 1 Steps 8–9 |
| Wake Lock re-acquired when the page becomes visible | Task 1 Step 9 |
| Engine best-effort on iOS 17–18; iOS 26+ as a UI message | Task 2 Step 6 (`EXPORT_ERROR_MESSAGES.UNSUPPORTED_BROWSER`), Task 5 Step 5 |
| iPhone manual checklist (4K speed, HEVC, screen off, Gem i Fotos) | CLAUDE.md "Åbne punkter" (Task 6); run on a real iPhone before the PR is merged |
| AAC encode failure degrading to no audio | Not implemented; documented in CLAUDE.md |
| Cancel during audio decode / finalize | Not implemented; documented in CLAUDE.md |
| Mid-decode HEVC failures as `UNKNOWN` | Not implemented; documented in CLAUDE.md |
| Screen-off hang (watchdog) | Not implemented; documented in CLAUDE.md |
| Add `INVALID_PROJECT` to the spec error table | Task 6 Step 4 |
| Legacy geometry objects and server codes | Task 5 Step 3 |

## Spec coverage

| Spec | Task |
|---|---|
| 4 Architecture: delete server, Docker, smoke tests, obsolete E2E, service worker, `shared/exportJob.ts`, dead code, AI Studio leftovers | Tasks 4, 5 |
| 6 Export screen (capabilities, no privacy popup, progress, cancel, errors) | Task 2 |
| 6 Success screen (share file, download, real resolution and duration, audio warning) | Task 2 |
| 6 Projects without `jobId`/`downloadUrl`/`expiresAt`, legacy data readable | Task 2 |
| 6 Preview = export (`AnnotationCanvas` in editor, review, preview; measured text; freeze badge) | Task 3 |
| 6 "Klar til offline-brug" removed | Task 5 |
| 7 Error messages | Task 2 (shown from `ExportError.message`) |
| 8.3 E2E: export-flow, cancel-export, delete-projects, app | Task 4 |
| 8.4 CI without Docker | Task 6 |
| 9 `vercel.json` headers, build settings | Task 4 |
| 9 Production branch, domain and DNS | Plan D (outside this plan) |
| 10.4 Delete `spike/browser-export`, OneDrive `.claude/launch.json` | Plan D (outside this plan) |
