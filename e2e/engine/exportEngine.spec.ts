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

  // landscape-tone.mp4 has silent gaps at source 2.0-2.2s and 4.0-4.2s. The clip runs 1-5 with a
  // 2s freeze at 3, so output 0-2s is source 1-3, output 2-4s is the freeze, output 4-6s is
  // source 3-5 — the gaps land at output 1.0-1.2s and 5.0-5.2s. This proves the WebCodecs audio
  // path lands tone at the right source time rather than merely being loud somewhere.
  const gaps = await inspect(page, {
    name: "annotated",
    audioWindows: [
      [0.85, 0.95],
      [1.05, 1.15],
      [1.25, 1.35],
      [4.85, 4.95],
      [5.05, 5.15],
      [5.25, 5.35],
    ],
  });
  const [beforeGap1, inGap1, afterGap1, beforeGap2, inGap2, afterGap2] = gaps.audioPeaks;
  expect(beforeGap1).toBeGreaterThan(0.05);
  expect(inGap1).toBeLessThan(0.02);
  expect(afterGap1).toBeGreaterThan(0.05);
  expect(beforeGap2).toBeGreaterThan(0.05);
  expect(inGap2).toBeLessThan(0.02);
  expect(afterGap2).toBeGreaterThan(0.05);
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

  // Same gap-position check as the WebCodecs path (see the landscape test above): this is the
  // path iPhones use, so an AAC priming or trim offset here would otherwise go unnoticed.
  const gaps = await inspect(page, {
    name: "webaudio",
    audioWindows: [
      [0.85, 0.95],
      [1.05, 1.15],
      [1.25, 1.35],
      [4.85, 4.95],
      [5.05, 5.15],
      [5.25, 5.35],
    ],
  });
  const [beforeGap1, inGap1, afterGap1, beforeGap2, inGap2, afterGap2] = gaps.audioPeaks;
  expect(beforeGap1).toBeGreaterThan(0.05);
  expect(inGap1).toBeLessThan(0.02);
  expect(afterGap1).toBeGreaterThan(0.05);
  expect(beforeGap2).toBeGreaterThan(0.05);
  expect(inGap2).toBeLessThan(0.02);
  expect(afterGap2).toBeGreaterThan(0.05);
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
