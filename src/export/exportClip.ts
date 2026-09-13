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

// Without `strict`/`strictNullChecks` (this project's tsconfig has neither), TS does not narrow
// `IteratorResult<T, void>` via `!result.done` property checks alone; a user-defined type guard
// forces the narrowing without weakening the type.
function hasValue<T>(result: IteratorResult<T, void>): result is IteratorYieldResult<T> {
  return !result.done;
}

// Yields, for each target time, the latest decoded frame whose timestamp is <= that time.
async function* framesAtTimes(sink: VideoSampleSink, segment: VideoSegment, times: number[]) {
  const iterator = sink.samples(segment.start, segment.end)[Symbol.asyncIterator]();
  // VideoSample.draw applies the track's rotation metadata, so portrait phone video is drawn upright.
  let current: VideoSample | null = null;
  let next = await iterator.next();
  try {
    for (const time of times) {
      let changed = false;
      while (hasValue(next) && next.value.timestamp <= time + 1e-6) {
        current?.close();
        current = next.value;
        changed = true;
        next = await iterator.next();
      }
      yield { sample: current, changed };
    }
  } finally {
    current?.close();
    if (hasValue(next)) next.value.close();
    await iterator.return?.(undefined);
  }
}

export async function exportClip(options: ExportClipOptions): Promise<ExportedClip> {
  const { file, project, signal, onProgress = () => {}, overrides = {} } = options;
  let wasHidden = typeof document !== "undefined" && document.hidden;
  const onVisibility = () => {
    if (document.hidden) wasHidden = true;
  };

  let input: Input | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let sink: ExportSink | null = null;
  let output: Output | null = null;
  let audio: DecodedClipAudio | null = null;

  try {
    onProgress({ stage: "preparing", fraction: 0 });

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
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
    input?.dispose();
    await wakeLock?.release().catch(() => {});
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  }
}
