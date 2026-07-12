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

async function runCombinedSmokeTest() {
  const inputPath = path.resolve("test_input_combined.mp4");
  const outputPath = path.resolve("test_output_combined.mp4");
  const tempDir = path.resolve("./tmp/combined_test_temp");

  console.log("--- STARTING COMBINED SMOKE TEST: ALL ANNOTATIONS & FREEZE ---");

  // Cleanup potential leftover files
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  fs.mkdirSync(tempDir, { recursive: true });

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

    // 3. Setup export metadata with Text, Circle, Arrow, and Freeze
    console.log("Step 3: Defining annotations and freeze request...");
    const requestMetadata = {
      projectId: "smoke_combined_project",
      clip: {
        startTime: 1.0,
        endTime: 5.0 // Clip duration: 4.0s
      },
      annotations: [
        {
          id: "a1",
          type: "text",
          text: "CoachClip Test",
          x: 0.5,
          y: 0.2,
          startTime: 1.5,
          endTime: 4.5,
          size: "medium",
          color: "white"
        },
        {
          id: "a2",
          type: "circle",
          x: 0.3,
          y: 0.5,
          radius: 0.15,
          startTime: 2.0,
          endTime: 4.0,
          color: "yellow",
          thickness: "bold"
        },
        {
          id: "a3",
          type: "arrow",
          startX: 0.7,
          startY: 0.7,
          endX: 0.8,
          endY: 0.8,
          startTime: 2.5,
          endTime: 4.5,
          color: "red",
          thickness: "normal"
        },
        {
          id: "a4",
          type: "freeze",
          time: 3.0,
          duration: 2.0 // 2.0s freeze
        }
      ] as any[]
    };

    // 4. Run the full executeExport pipeline
    console.log("Step 4: Executing full export pipeline with annotations and freeze...");
    await FfmpegExportService.executeExport(
      "combined-smoke-job-123",
      requestMetadata as any,
      inputPath,
      outputPath,
      tempDir
    );
    console.log("Export execution finished.");

    // 5. Validate output file with ffprobe
    console.log("Step 5: Validating output file with ffprobe...");
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

    if (videoStream.codec_name !== "h264") {
      throw new Error(`Expected codec h264, got ${videoStream.codec_name}`);
    }
    if (videoStream.width !== 640 || videoStream.height !== 360) {
      throw new Error(`Expected 640x360 resolution, got ${videoStream.width}x${videoStream.height}`);
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

    // Probe overall format (duration)
    // Expected duration: (5.0 - 1.0) clip + 2.0 freeze = 6.0 seconds
    const formatProbe = execSync(
      `ffprobe -v error -show_entries format=duration,format_name -of json "${outputPath}"`
    ).toString();
    const formatData = JSON.parse(formatProbe);
    const duration = Number(formatData.format?.duration);
    console.log(`Detected duration: ${duration}s`);

    const expectedDuration = 6.0;
    const tolerance = 0.25;
    if (Math.abs(duration - expectedDuration) > tolerance) {
      throw new Error(`Expected duration around ${expectedDuration}s (tolerance ±${tolerance}s), got ${duration}s`);
    }

    // Ensure it can be decoded by ffmpeg without errors
    console.log("Step 6: Verifying video decodability with ffmpeg...");
    execSync(`ffmpeg -v error -i "${outputPath}" -f null -`, { stdio: "inherit" });
    console.log("Video successfully decoded without errors!");

    console.log("\n--- COMBINED SMOKE TEST: ALL ANNOTATIONS & FREEZE PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- COMBINED SMOKE TEST: ALL ANNOTATIONS & FREEZE FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    // Clean up test files and directories
    console.log("Step 7: Cleaning up test files...");
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
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
    console.log("Cleanup complete.");
  }
}

runCombinedSmokeTest();
