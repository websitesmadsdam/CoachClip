/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: simple standalone smoke test script uses raw any and ignored args for flexibility.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { FfmpegExportService } from "../server/src/services/ffmpegExportService";

async function runSmokeTest() {
  const inputPath = path.resolve("test_input_no_audio.mp4");
  const outputPath = path.resolve("test_output_no_audio.mp4");

  console.log("--- STARTING SMOKE TEST: EXPORT WITHOUT AUDIO ---");

  // Cleanup potential leftover files
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  try {
    // 1. Generate synthetic test video WITHOUT audio
    console.log("Step 1: Generating synthetic test video without audio...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -c:v libx264 -pix_fmt yuv420p -y "${inputPath}"`,
      { stdio: "ignore" }
    );
    console.log("Synthetic video (no audio) generated at:", inputPath);

    // 2. Extract metadata
    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(inputPath);
    console.log("Input Metadata:", metadata);

    // 3. Export simple clip (Trim 1s to 5s, duration 4s)
    console.log("Step 3: Exporting simple trimmed clip (no audio)...");
    const result = await FfmpegExportService.exportSimpleClip({
      inputPath,
      outputPath,
      startTime: 1.0,
      duration: 4.0,
      sourceMetadata: metadata,
    });
    console.log("Export succeeded:", result);

    // 4. Validate output with ffprobe
    console.log("Step 4: Validating output file with ffprobe...");
    if (!fs.existsSync(outputPath)) {
      throw new Error("Output file was not created!");
    }

    const stats = fs.statSync(outputPath);
    console.log(`Output file size: ${stats.size} bytes`);
    if (stats.size === 0) {
      throw new Error("Output file is empty (0 bytes)!");
    }

    // Probe video stream
    const videoProbe = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt -of json "${outputPath}"`
    ).toString();
    const videoData = JSON.parse(videoProbe);
    const videoStream = videoData.streams?.[0];

    if (!videoStream) {
      throw new Error("No video stream found in output!");
    }
    console.log("Video Stream data:", videoStream);

    // Probe audio stream - MUST be empty!
    const audioProbe = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of json "${outputPath}"`
    ).toString();
    const audioData = JSON.parse(audioProbe);
    const audioStream = audioData.streams?.[0];

    if (audioStream) {
      throw new Error(`Expected NO audio stream, but found codec: ${audioStream.codec_name}`);
    }
    console.log("Audio Stream successfully absent as expected.");

    // Probe overall format (duration)
    const formatProbe = execSync(
      `ffprobe -v error -show_entries format=duration,format_name -of json "${outputPath}"`
    ).toString();
    const formatData = JSON.parse(formatProbe);
    const duration = Number(formatData.format?.duration);
    console.log(`Detected duration: ${duration}s`);

    const tolerance = 0.15;
    if (Math.abs(duration - 4.0) > tolerance) {
      throw new Error(`Expected duration around 4.0s (tolerance ±${tolerance}s), got ${duration}s`);
    }

    // Ensure it can be decoded by ffmpeg without errors
    console.log("Step 5: Verifying video decodability with ffmpeg...");
    execSync(`ffmpeg -v error -i "${outputPath}" -f null -`, { stdio: "inherit" });
    console.log("Video successfully decoded without errors!");

    console.log("\n--- SMOKE TEST: EXPORT WITHOUT AUDIO PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: EXPORT WITHOUT AUDIO FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    // Clean up test files
    console.log("Step 6: Cleaning up test files...");
    if (fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (e) {
        // ignore
      }
    }
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        // ignore
      }
    }
    console.log("Cleanup complete.");
  }
}

runSmokeTest();
