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
