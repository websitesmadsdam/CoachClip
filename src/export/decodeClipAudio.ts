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
  // A decoder that silently yields nothing gets the same second chance as one that throws.
  if (samples.length === 0) throw new Error("WebCodecs produced no audio samples");
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
