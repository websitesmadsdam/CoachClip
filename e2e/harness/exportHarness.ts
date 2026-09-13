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
declare global {
  interface Window {
    coachclipHarness: typeof harness;
  }
}
window.coachclipHarness = harness;
document.getElementById("status")!.textContent = "ready";
