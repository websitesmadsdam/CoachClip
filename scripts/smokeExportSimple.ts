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
  const inputPath = path.resolve("test_input_simple.mp4");
  const outputPath = path.resolve("test_output_simple.mp4");

  console.log("--- STARTING SMOKE TEST: SIMPLE EXPORT ---");

  // Cleanup potential leftover files
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  try {
    // 1. Generate synthetic test video: 6s duration, 640x360, H.264 video, AAC audio
    console.log("Step 1: Generating synthetic test video...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -f lavfi -i "sine=frequency=1000:duration=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );
    console.log("Synthetic video generated at:", inputPath);

    // 2. Extract metadata
    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(inputPath);
    console.log("Input Metadata:", metadata);

    if (metadata.width !== 640 || metadata.height !== 360) {
      throw new Error(`Expected size 640x360, got ${metadata.width}x${metadata.height}`);
    }

    // 3. Export simple clip (Trim from 1.0s, duration 4.0s)
    console.log("Step 3: Exporting simple trimmed clip (1s to 5s, duration 4s)...");
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
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate -of json "${outputPath}"`
    ).toString();
    const videoData = JSON.parse(videoProbe);
    const videoStream = videoData.streams?.[0];

    if (!videoStream) {
      throw new Error("No video stream found in output!");
    }
    console.log("Video Stream data:", videoStream);

    if (videoStream.codec_name !== "h264") {
      throw new Error(`Expected codec h264, got ${videoStream.codec_name}`);
    }
    if (videoStream.width !== 640 || videoStream.height !== 360) {
      throw new Error(`Expected 640x360 resolution, got ${videoStream.width}x${videoStream.height}`);
    }
    if (videoStream.pix_fmt !== "yuv420p") {
      throw new Error(`Expected pixel format yuv420p, got ${videoStream.pix_fmt}`);
    }

    // Probe audio stream
    const audioProbe = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of json "${outputPath}"`
    ).toString();
    const audioData = JSON.parse(audioProbe);
    const audioStream = audioData.streams?.[0];

    if (!audioStream) {
      throw new Error("No audio stream found in output!");
    }
    console.log("Audio Stream data:", audioStream);

    if (audioStream.codec_name !== "aac") {
      throw new Error(`Expected audio codec aac, got ${audioStream.codec_name}`);
    }

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

    console.log("\n--- SMOKE TEST: SIMPLE EXPORT PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: SIMPLE EXPORT FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    // 9. Clean up test files
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
