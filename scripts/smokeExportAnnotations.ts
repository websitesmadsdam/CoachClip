/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { FfmpegExportService } from "../server/src/services/ffmpegExportService";

async function runCombinedAnnotationsSmokeTest() {
  const inputPath = path.resolve("test_input_combined.mp4");
  const outputPath = path.resolve("test_output_combined.mp4");
  const tempDir = path.resolve("./tmp/combined_test_temp");

  console.log("--- STARTING SMOKE TEST: COMBINED ANNOTATIONS ---");

  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log("Step 1: Generating synthetic test video...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 -f lavfi -i "sine=frequency=1000:duration=10" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );

    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(inputPath);
    console.log("Dimensions:", metadata);

    console.log("Step 3: Exporting combined clip with circle, arrow, text, and freeze annotations...");
    const combinedMetadata = {
      projectId: "combined_annotations_project",
      clip: { startTime: 1.0, endTime: 8.0 }, // 7s base clip
      annotations: [
        {
          id: "c1",
          type: "circle",
          x: 0.3,
          y: 0.4,
          radius: 0.1,
          startTime: 2.0,
          endTime: 5.0,
          color: "yellow",
          thickness: "bold"
        },
        {
          id: "a1",
          type: "arrow",
          startX: 0.5,
          startY: 0.5,
          endX: 0.7,
          endY: 0.7,
          startTime: 3.0,
          endTime: 6.0,
          color: "red"
        },
        {
          id: "t1",
          type: "text",
          text: "Multi-annotation test",
          x: 0.5,
          y: 0.2,
          startTime: 2.5,
          endTime: 5.5,
          size: "normal",
          color: "white"
        },
        {
          id: "f1",
          type: "freeze",
          time: 4.0,
          duration: 1.5 // 1.5s freeze
        }
      ]
    };

    await FfmpegExportService.executeExport("combined-job-id", combinedMetadata as any, inputPath, outputPath, tempDir);

    console.log("Step 4: Verifying combined output existence and metadata...");
    if (!fs.existsSync(outputPath)) {
      throw new Error("Combined output file was not created!");
    }

    const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`).toString().trim();
    const duration = parseFloat(durationStr);
    console.log(`Combined Output Duration: ${duration}s (Expected: ~8.5s)`);

    // Expected duration is (8.0 - 1.0) + 1.5 = 8.5 seconds
    if (Math.abs(duration - 8.5) > 0.15) {
      throw new Error(`Expected output duration to be ~8.5s, but got ${duration}s.`);
    }

    console.log("\n--- SMOKE TEST: COMBINED ANNOTATIONS PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: COMBINED ANNOTATIONS FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    console.log("Step 5: Cleaning up...");
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runCombinedAnnotationsSmokeTest();
