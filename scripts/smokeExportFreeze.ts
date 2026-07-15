/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { FfmpegExportService } from "../server/src/services/ffmpegExportService";

function comparePngs(img1Path: string, img2Path: string): { diffPixels: number; width: number; height: number } {
  const img1 = PNG.sync.read(fs.readFileSync(img1Path));
  const img2 = PNG.sync.read(fs.readFileSync(img2Path));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(`Images must be of same dimensions: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  return { diffPixels, width, height };
}

async function runFreezeSmokeTest() {
  const inputPath = path.resolve("test_input_freeze.mp4");
  const refPath = path.resolve("test_output_freeze_ref.mp4");
  const annotatedPath = path.resolve("test_output_freeze_annotated.mp4");
  const tempDir = path.resolve("./tmp/freeze_test_temp");

  console.log("--- STARTING SMOKE TEST: FREEZE FRAME ANNOTATIONS ---");

  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
  if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log("Step 1: Generating synthetic test video...");
    // Generates a test pattern with moving lines (sine sweep visual) so frames are dynamic
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -f lavfi -i "sine=frequency=1000:duration=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );

    const refInput = path.resolve("test_input_freeze_ref.mp4");
    const annoInput = path.resolve("test_input_freeze_anno.mp4");
    fs.copyFileSync(inputPath, refInput);
    fs.copyFileSync(inputPath, annoInput);

    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(refInput);

    console.log("Step 3: Exporting reference clip (1.0s to 5.0s, should be 4.0s duration)...");
    const refMetadata = {
      projectId: "ref_freeze_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: []
    };
    await FfmpegExportService.executeExport("ref-freeze-job", refMetadata as any, refInput, refPath, tempDir);

    console.log("Step 4: Exporting clip with 2.0s freeze at timestamp 3.0s (output duration should be 6.0s)...");
    const annotatedMetadata = {
      projectId: "annotated_freeze_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: [
        {
          id: "f1",
          type: "freeze",
          time: 3.0,
          duration: 2.0
        }
      ]
    };
    await FfmpegExportService.executeExport("annotated-freeze-job", annotatedMetadata as any, annoInput, annotatedPath, tempDir);

    console.log("Step 5: Verifying output video durations using ffprobe...");
    const refDurationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${refPath}"`).toString().trim();
    const annoDurationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${annotatedPath}"`).toString().trim();

    const refDuration = parseFloat(refDurationStr);
    const annoDuration = parseFloat(annoDurationStr);

    console.log(`Reference Duration: ${refDuration}s`);
    console.log(`Annotated (Freeze) Duration: ${annoDuration}s`);

    // Allow small tolerance (up to 0.1s due to frame rounding/container overhead)
    const durationDiff = annoDuration - refDuration;
    console.log(`Duration Difference: ${durationDiff}s (Expected: ~2.0s)`);
    if (Math.abs(durationDiff - 2.0) > 0.15) {
      throw new Error(`Expected output duration to increase by ~2.0s, but got ${durationDiff}s difference.`);
    }

    console.log("Step 6: Verifying static/frozen frame during freeze period...");
    // Freeze starts at 3.0s in original timeline. Since output starts at 1.0s,
    // freeze is active at 2.0s in the output timeline, and lasts until 4.0s.
    // Let's extract frames at 2.3s and 3.7s from the annotated video and verify they are identical!
    const frame1Png = path.join(tempDir, "freeze_frame_1.png");
    const frame2Png = path.join(tempDir, "freeze_frame_2.png");

    execSync(`ffmpeg -ss 2.3 -i "${annotatedPath}" -vframes 1 -y "${frame1Png}"`, { stdio: "ignore" });
    execSync(`ffmpeg -ss 3.7 -i "${annotatedPath}" -vframes 1 -y "${frame2Png}"`, { stdio: "ignore" });

    const freezeDiff = comparePngs(frame1Png, frame2Png);
    console.log(`Freeze frame pixel difference during freeze: ${freezeDiff.diffPixels} pixels`);

    if (freezeDiff.diffPixels !== 0) {
      throw new Error("Expected frame to be static/frozen during freeze period, but got mismatched pixels.");
    }

    console.log("Step 6.5: Verifying audio parameters (sample rate, channel layout, audio presence)...");
    const audioProbe = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,channel_layout -of json "${annotatedPath}"`
    ).toString();
    const audioData = JSON.parse(audioProbe);
    const audioStream = audioData.streams?.[0];

    if (!audioStream) {
      throw new Error("Expected an audio stream in the annotated freeze output, but none was found!");
    }
    console.log("Audio Stream properties:", audioStream);

    if (audioStream.codec_name !== "aac") {
      throw new Error(`Expected audio codec to be aac, but got: ${audioStream.codec_name}`);
    }
    if (Number(audioStream.sample_rate) !== 48000) {
      throw new Error(`Expected audio sample rate to be 48000 Hz, but got: ${audioStream.sample_rate}`);
    }
    const isStereo = audioStream.channel_layout === "stereo" || Number(audioStream.channels) === 2;
    if (!isStereo) {
      throw new Error(`Expected audio channel layout to be stereo (2 channels), but got: ${audioStream.channel_layout} (${audioStream.channels} channels)`);
    }

    // Verify audio presence during freeze frame (from 2.0s to 4.0s) by exporting a 1s snippet and checking it has audio
    const testSnippetPath = path.join(tempDir, "freeze_audio_snippet.mp4");
    execSync(`ffmpeg -ss 2.5 -t 1.0 -i "${annotatedPath}" -c:a copy -y "${testSnippetPath}"`, { stdio: "ignore" });
    const snippetProbe = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate -of json "${testSnippetPath}"`
    ).toString();
    const snippetData = JSON.parse(snippetProbe);
    if (!snippetData.streams?.[0]) {
      throw new Error("Expected audio stream to be preserved during freeze period snippet!");
    }
    console.log("Audio stream successfully verified during freeze period.");

    console.log("\n--- SMOKE TEST: FREEZE FRAME ANNOTATIONS PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: FREEZE FRAME ANNOTATIONS FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    console.log("Step 7: Cleaning up...");
    const refInput = path.resolve("test_input_freeze_ref.mp4");
    const annoInput = path.resolve("test_input_freeze_anno.mp4");
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(refInput)) fs.unlinkSync(refInput);
    if (fs.existsSync(annoInput)) fs.unlinkSync(annoInput);
    if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
    if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runFreezeSmokeTest();
